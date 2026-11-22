import fs from 'node:fs';
import path from 'node:path';
import { readCommit, readTree, resolveRef } from 'isomorphic-git';

export async function latestContentCommitDate(root: string): Promise<string> {
  try {
    const dotGit = path.join(root, '.git');
    const gitdir = fs.statSync(dotGit).isDirectory()
      ? dotGit
      : path.resolve(root, fs.readFileSync(dotGit, 'utf8').trim().replace(/^gitdir: /, ''));
    const commonFile = path.join(gitdir, 'commondir');
    const commonDir = fs.existsSync(commonFile)
      ? path.resolve(gitdir, fs.readFileSync(commonFile, 'utf8').trim())
      : gitdir;
    const repo = { fs, gitdir: commonDir, cache: {} };
    const head = fs.readFileSync(path.join(gitdir, 'HEAD'), 'utf8').trim();
    const oid = head.startsWith('ref: ') ? await resolveRef({ ...repo, ref: head.slice(5) }) : head;
    const contentTrees = async (treeOid: string) => {
      const { tree } = await readTree({ ...repo, oid: treeOid });
      return ['content', '_content'].map((name) => tree.find((entry) => entry.path === name)?.oid).join(':');
    };

    let { commit } = await readCommit({ ...repo, oid });
    let trees = await contentTrees(commit.tree);
    for (;;) {
      const [parent] = commit.parent;
      const previous = parent ? (await readCommit({ ...repo, oid: parent })).commit : null;
      const previousTrees = previous ? await contentTrees(previous.tree) : ':';
      if (previousTrees !== trees) return new Date(commit.committer.timestamp * 1000).toISOString();
      if (!previous) throw new Error('no commit changes content/ or _content/');
      commit = previous;
      trees = previousTrees;
    }
  } catch (error) {
    throw new Error('Cannot determine the latest content commit date. Use a checkout with enough history to reach the last content change.', { cause: error });
  }
}
