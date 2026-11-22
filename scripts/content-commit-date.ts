import fs from 'node:fs';
import path from 'node:path';
import { readCommit, readTree, resolveRef } from 'isomorphic-git';

/**
 * When the archive content last changed, from git history. `date` is null only when the checkout
 * cannot answer: no git metadata at all, or a shallow clone (Vercel clones shallowly) whose history
 * ends before the last content change. `note` then says why, so the export never guesses a date.
 */
export type ContentCommitDate = { date: string; note: null } | { date: null; note: string };

export const NO_GIT_NOTE = 'This build had no git metadata, so the date of the last content change is unknown.';
export const SHALLOW_NOTE =
  'This build used a shallow git clone whose history ends before the last content change, so its date is unknown.';

function readOptional(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * The UTC committer time of the most recent first-parent commit that changed `content/` or `_content/`.
 * Any failure other than missing git metadata or a too-shallow history is an error: a corrupt
 * repository must not silently produce an export without a date.
 */
export async function contentCommitDate(root: string): Promise<ContentCommitDate> {
  const dotGit = path.join(root, '.git');
  const dotGitStat = fs.statSync(dotGit, { throwIfNoEntry: false });
  if (!dotGitStat) return { date: null, note: NO_GIT_NOTE };
  try {
    const gitdir = dotGitStat.isDirectory()
      ? dotGit
      : path.resolve(root, fs.readFileSync(dotGit, 'utf8').trim().replace(/^gitdir: /, ''));
    const common = readOptional(path.join(gitdir, 'commondir'));
    const commonDir = common === null ? gitdir : path.resolve(gitdir, common.trim());
    // A shallow clone lists the commits whose parents were not fetched.
    const shallow = new Set((readOptional(path.join(commonDir, 'shallow')) ?? '').split('\n').filter(Boolean));
    const repo = { fs, gitdir: commonDir, cache: {} };
    const head = fs.readFileSync(path.join(gitdir, 'HEAD'), 'utf8').trim();
    let oid = head.startsWith('ref: ') ? await resolveRef({ ...repo, ref: head.slice(5) }) : head;
    const contentTrees = async (treeOid: string) => {
      const { tree } = await readTree({ ...repo, oid: treeOid });
      return ['content', '_content'].map((name) => tree.find((entry) => entry.path === name)?.oid).join(':');
    };

    let { commit } = await readCommit({ ...repo, oid });
    let trees = await contentTrees(commit.tree);
    for (;;) {
      const [parent] = commit.parent;
      if (parent && shallow.has(oid)) return { date: null, note: SHALLOW_NOTE };
      const previous = parent ? (await readCommit({ ...repo, oid: parent })).commit : null;
      const previousTrees = previous ? await contentTrees(previous.tree) : ':';
      if (previousTrees !== trees) return { date: new Date(commit.committer.timestamp * 1000).toISOString(), note: null };
      if (!previous) throw new Error('no commit changes content/ or _content/');
      oid = parent;
      commit = previous;
      trees = previousTrees;
    }
  } catch (error) {
    throw new Error('Cannot read the date of the last content change from git history.', { cause: error });
  }
}
