import fs from 'node:fs';
import path from 'node:path';
import YAML, { Scalar } from 'yaml';
import { ENTITY_TYPES, SLUG, type EntityType, type Kind } from '../src/lib/content/schema';
import { SCAFFOLD_SOURCE, SCAFFOLD_TODO, SCAFFOLD_URL } from '../src/lib/content/scaffold-markers';

const kinds: Record<EntityType, Kind> = {
  event: 'event',
  person: 'person',
  text: 'text',
  site: 'site',
  polity: 'polity',
  artifact: 'art',
  tradition: 'dharma',
  concept: 'science',
  cosmology: 'cosmology',
};

export function scaffoldContent(
  mode: 'entity' | 'source',
  args: string[],
  root = process.cwd(),
): number {
  const usage = mode === 'entity'
    ? 'npm run content:new -- <type> <slug>'
    : 'npm run content:new-source -- <slug>';
  if (args.length === 1 && args[0] === '--help') {
    console.log(`usage: ${usage}`);
    if (mode === 'entity') console.log(`types: "${ENTITY_TYPES.join(', ')}"`);
    return 0;
  }
  const unsupported = args.find((arg) => arg.startsWith('-'));
  const [type, slug] = mode === 'entity' ? args : [null, args[0]];
  const problem = unsupported ? `Unknown flag ${unsupported}; supported flag is --help.`
    : args.length !== (mode === 'entity' ? 2 : 1) ? 'Supply the required arguments.'
    : mode === 'entity' && !ENTITY_TYPES.some((value) => value === type) ? `Choose an entity type from ${ENTITY_TYPES.join(', ')}.`
    : !SLUG.test(slug ?? '') ? 'Use a lowercase slug with letters, digits and single hyphens, such as example-name.'
    : null;
  if (problem) {
    console.log(`error: ${JSON.stringify(problem)}\nusage: ${usage}`);
    return 2;
  }

  const file = mode === 'entity'
    ? path.join('content', 'entities', type!, `${slug}.yaml`)
    : path.join('content', 'sources', `${slug}.yaml`);
  const fullPath = path.join(root, file);
  const scaffold = (mode === 'entity' ? entityScaffold(type as EntityType, slug) : sourceScaffold(slug)).toString();
  const next = `help: Fill the scaffold fields, then run npm run content:check -- ${file}`;
  try {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, scaffold, { flag: 'wx' });
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    // Rerunning the same command is a no-op while the scaffold is untouched; edited work is never replaced.
    if (errno.code === 'EEXIST' && fs.readFileSync(fullPath, 'utf8') === scaffold) {
      console.log(`unchanged: ${file} already holds this scaffold\n${next}`);
      return 0;
    }
    const message = errno.code === 'EEXIST'
      ? `${file} already exists. Edit that file or choose a new slug.`
      : `Could not write ${file}: ${errno.message}`;
    console.log(`error: ${JSON.stringify(message)}`);
    return 1;
  }
  console.log(`created: ${file}\n${next}`);
  return 0;
}

function entityScaffold(type: EntityType, slug: string) {
  const cosmology = type === 'cosmology';
  const document = new YAML.Document({
    id: `${type}.${slug}`,
    type,
    kind: kinds[type],
    names: { en: `${SCAFFOLD_TODO} Enter the English name` },
    summary: `${SCAFFOLD_TODO} Write a factual summary supported by the evidence below`,
    datings: [{
      method: cosmology ? 'traditional-puranic' : 'scholarly-consensus',
      range: { earliest: '1 BCE', latest: '1 BCE', precision: 'year', circa: true },
      grade: cosmology ? 'D' : 'B',
      sources: [SCAFFOLD_SOURCE],
      note: `${SCAFFOLD_TODO} Replace the example years and explain the method, precision and grade`,
    }],
    claims: [{
      text: `${SCAFFOLD_TODO} State a checkable claim supported by the cited work`,
      grade: cosmology ? 'D' : 'B',
      sources: [SCAFFOLD_SOURCE],
    }],
    relations: [],
    tags: [],
    review: { status: 'draft', reviewer: null, lastReviewed: null },
  });
  document.commentBefore = ' Fill all scaffold placeholders. Choose the kind, dating method and grades using docs/editorial/STYLE.md.';
  for (const field of ['earliest', 'latest']) {
    const year = document.getIn(['datings', 0, 'range', field], true) as Scalar;
    year.type = Scalar.QUOTE_DOUBLE;
  }
  return document;
}

function sourceScaffold(slug: string) {
  const document = new YAML.Document({
    id: `src.${slug}`,
    type: 'web',
    title: `${SCAFFOLD_TODO} Enter the title exactly as it appears at the registry or publisher`,
    authors: [`${SCAFFOLD_TODO} Enter the author or organisation, or use editors, publisher or corpus`],
    url: SCAFFOLD_URL,
  });
  document.commentBefore = ' Choose the source type and add a real URL, DOI, ISBN or OCLC number. See docs/editorial/STYLE.md.';
  return document;
}
