import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DebateSchema, LearningPathSchema, QuizQuestionSchema, EntitySchema } from './schema';
import { detectScript, nativeLang, romanisedLang } from './script';
import { LEVEL_ATTRIBUTE, LEVEL_STORAGE_KEY, READING_LEVEL_BOOT_SCRIPT, parseLevel, resolveLevel, shownLevel } from '../reading-level';

const FIX = (name: string) => path.join(__dirname, '__fixtures__', name);

async function inFixture<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const cwd = process.cwd();
  process.chdir(FIX(name));
  vi.resetModules();
  try {
    return await fn();
  } finally {
    process.chdir(cwd);
  }
}

const evidence = { text: 'A line of evidence that is long enough.', grade: 'C', sources: [{ id: 'src.a-2000-b', locator: 'p. 1' }] };
const position = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: `Position ${id}`,
  lens: 'scholarship',
  statement: 'A steelmanned statement of the position, long enough to pass the schema.',
  grade: 'C',
  proponents: [{ name: 'Jane Doe' }],
  evidence: [evidence],
  ...extra,
});
const debate = (extra: Record<string, unknown> = {}) => ({
  id: 'debate.a-question',
  title: 'A question',
  question: 'When did it happen?',
  summary: 'A fixture summary of a contested question.',
  positions: [position('one'), position('two')],
  whatWouldChangeThis: ['A dated inscription would settle the question.'],
  relatedEntities: ['person.someone'],
  review: { status: 'draft' },
  ...extra,
});

describe('debate schema', () => {
  it('accepts a well-formed debate and defaults published to false', () => {
    const r = DebateSchema.safeParse(debate());
    expect(r.success).toBe(true);
    expect(r.data?.published).toBe(false);
  });
  it('needs at least two positions', () => {
    expect(DebateSchema.safeParse(debate({ positions: [position('one')] })).success).toBe(false);
  });
  it('needs named proponents and cited evidence on every position', () => {
    expect(DebateSchema.safeParse(debate({ positions: [position('one'), position('two', { proponents: [] })] })).success).toBe(false);
    expect(DebateSchema.safeParse(debate({ positions: [position('one'), position('two', { evidence: [] })] })).success).toBe(false);
    expect(DebateSchema.safeParse(debate({ positions: [position('one'), position('two', { evidence: [{ ...evidence, sources: [] }] })] })).success).toBe(false);
  });
  it('requires a locator on every evidence citation', () => {
    const bare = { ...evidence, sources: ['src.a-2000-b'] };
    expect(DebateSchema.safeParse(debate({ positions: [position('one'), position('two', { evidence: [bare] })] })).success).toBe(false);
  });
  it('refuses publication without owner approval', () => {
    expect(DebateSchema.safeParse(debate({ published: true })).success).toBe(false);
    expect(DebateSchema.safeParse(debate({ published: true, approval: { by: 'Owner', date: '2026-11-21' } })).success).toBe(true);
  });
  it('keeps grade D for tradition positions only', () => {
    expect(DebateSchema.safeParse(debate({ positions: [position('one'), position('two', { lens: 'tradition', grade: 'C' })] })).success).toBe(false);
    expect(DebateSchema.safeParse(debate({ positions: [position('one'), position('two', { lens: 'tradition', grade: 'D' })] })).success).toBe(true);
    expect(DebateSchema.safeParse(debate({ positions: [position('one'), position('two', { grade: 'D' })] })).success).toBe(false);
  });
  it('rejects duplicate position ids, a question without a question mark, and inverted ranges', () => {
    expect(DebateSchema.safeParse(debate({ positions: [position('one'), position('one')] })).success).toBe(false);
    expect(DebateSchema.safeParse(debate({ question: 'When did it happen' })).success).toBe(false);
    const inverted = { earliest: '200 BCE', latest: '300 BCE', precision: 'decade', circa: true };
    expect(DebateSchema.safeParse(debate({ positions: [position('one'), position('two', { range: inverted })] })).success).toBe(false);
  });
});

const choice = (text: string, correct = false) => ({ text, correct, explanation: `Why "${text}" is ${correct ? 'right' : 'wrong'}.` });
const question = (extra: Record<string, unknown> = {}) => ({
  id: 'q1',
  question: 'Which inscription names five Greek kings?',
  choices: [choice('Rock Edict XIII', true), choice('The Lumbini pillar')],
  sources: [{ id: 'src.a-2000-b', locator: 'Rock Edict XIII' }],
  ...extra,
});

describe('quiz schema', () => {
  it('accepts a fair question with one correct, explained, cited answer', () => {
    expect(QuizQuestionSchema.safeParse(question()).success).toBe(true);
  });
  it('needs exactly one correct choice', () => {
    expect(QuizQuestionSchema.safeParse(question({ choices: [choice('A', true), choice('B', true)] })).success).toBe(false);
    expect(QuizQuestionSchema.safeParse(question({ choices: [choice('A'), choice('B')] })).success).toBe(false);
  });
  it('needs a cited source for the correct answer and an explanation for every choice', () => {
    expect(QuizQuestionSchema.safeParse(question({ sources: [] })).success).toBe(false);
    expect(QuizQuestionSchema.safeParse(question({ choices: [choice('A', true), { text: 'B', explanation: '' }] })).success).toBe(false);
  });
  it('rejects trick questions', () => {
    expect(QuizQuestionSchema.safeParse(question({ choices: [choice('A', true), choice('All of the above')] })).success).toBe(false);
    expect(QuizQuestionSchema.safeParse(question({ choices: [choice('A', true), choice('none of these')] })).success).toBe(false);
    expect(QuizQuestionSchema.safeParse(question({ question: 'Which of these is NOT an edict?' })).success).toBe(false);
    expect(QuizQuestionSchema.safeParse(question({ choices: [choice('Same', true), choice('same')] })).success).toBe(false);
  });
});

describe('learning path schema', () => {
  const lp = (extra: Record<string, unknown> = {}) => ({
    id: 'learn.a-path',
    title: 'A path',
    level: 'teen',
    audience: 'Ages 13 to 17',
    summary: 'A fixture learning path summary.',
    goals: ['Explain how the fixture is dated.'],
    steps: [
      { entity: 'person.someone', note: 'Look at how the person is dated.' },
      { article: 'history/fixture', note: 'Read the article for context.' },
    ],
    quiz: [question()],
    review: { status: 'draft' },
    ...extra,
  });
  it('accepts a path of entity and article steps', () => {
    expect(LearningPathSchema.safeParse(lp()).success).toBe(true);
  });
  it('needs each step to reference exactly one entity or article', () => {
    expect(LearningPathSchema.safeParse(lp({ steps: [{ note: 'A step with no reference at all.' }, { entity: 'person.someone', note: 'Look at how the person is dated.' }] })).success).toBe(false);
    expect(
      LearningPathSchema.safeParse(lp({ steps: [{ entity: 'person.someone', article: 'history/fixture', note: 'A step with two references.' }, { article: 'history/fixture', note: 'Read it.' }] })).success,
    ).toBe(false);
  });
  it('accepts an optional focus range and rejects an inverted one', () => {
    expect(LearningPathSchema.safeParse(lp({ focus: { earliest: '324 BCE', latest: '232 BCE', precision: 'decade', circa: true } })).success).toBe(true);
    expect(LearningPathSchema.safeParse(lp({ focus: { earliest: '232 BCE', latest: '324 BCE', precision: 'decade', circa: true } })).success).toBe(false);
  });
  it('rejects unknown levels, malformed article references and repeated steps', () => {
    expect(LearningPathSchema.safeParse(lp({ level: 'expert' })).success).toBe(false);
    expect(LearningPathSchema.safeParse(lp({ steps: [{ article: 'fixture', note: 'Read the article for context.' }, { entity: 'person.someone', note: 'Look at how the person is dated.' }] })).success).toBe(false);
    const step = { entity: 'person.someone', note: 'Look at how the person is dated.' };
    expect(LearningPathSchema.safeParse(lp({ steps: [step, step] })).success).toBe(false);
  });
});

describe('loader: debates and learning paths', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('loads published and unpublished debates and learning paths without errors', async () => {
    await inFixture('phase3', async () => {
      const { loadContentUncached } = await import('./load');
      const g = loadContentUncached();
      expect(g.errors).toEqual([]);
      expect(g.debates.map((d) => [d.id, d.published])).toEqual([
        ['debate.approved-one', true],
        ['debate.draft-one', false],
      ]);
      expect(g.learningPaths.map((p) => p.id)).toEqual(['learn.a-path']);
    });
  });

  it('excludes unpublished debates from build output, links and search', async () => {
    await inFixture('phase3', async () => {
      vi.stubEnv('DEBATES_PREVIEW', '');
      const { loadContentUncached } = await import('./load');
      const { visibleDebates, debatesForEntity, debateSearchDocs, debateRange } = await import('./debates');
      const g = loadContentUncached();
      expect(visibleDebates(g.debates).map((d) => d.slug)).toEqual(['approved-one']);
      expect(debatesForEntity(g, 'person.someone').map((d) => d.slug)).toEqual(['approved-one']);
      expect(debateSearchDocs(g).map((d) => d.href)).toEqual(['/debates/approved-one']);
      // Placement in time comes from the scholarship positions' ranges.
      expect(debateRange(g, g.debates[0])).toMatchObject({ earliest: -299, latest: -249 });

      // The static params Next.js builds from: drafts produce no page.
      const page = await import('../../app/debates/[slug]/page');
      expect(page.generateStaticParams()).toEqual([{ slug: 'approved-one' }]);
    });
  });

  it('renders drafts only in a preview build, and never indexes them', async () => {
    await inFixture('phase3', async () => {
      vi.stubEnv('DEBATES_PREVIEW', '1');
      const { loadContentUncached } = await import('./load');
      const { visibleDebates, debateSearchDocs } = await import('./debates');
      const g = loadContentUncached();
      expect(visibleDebates(g.debates).map((d) => d.slug)).toEqual(['approved-one', 'draft-one']);
      expect(debateSearchDocs(g)).toHaveLength(1);
      const page = await import('../../app/debates/[slug]/page');
      expect(page.generateStaticParams()).toEqual([{ slug: 'approved-one' }, { slug: 'draft-one' }]);
    });
  });

  it('resolves learning path steps and search documents', async () => {
    await inFixture('phase3', async () => {
      const { loadContentUncached } = await import('./load');
      const { resolveSteps, pathsForEntity, learningSearchDocs, summaryAtLevel } = await import('./learning');
      const g = loadContentUncached();
      const p = g.learningPaths[0];
      expect(resolveSteps(g, p).map((s) => [s.kind, s.href])).toEqual([
        ['entity', '/archive/person/someone'],
        ['article', '/history/fixture'],
      ]);
      expect(pathsForEntity(g, 'person.someone').map((x) => x.id)).toEqual(['learn.a-path']);
      expect(learningSearchDocs(g)[0].href).toBe('/learn/a-path');
      expect(summaryAtLevel(g.entities.get('person.someone')!, 'teen')).toContain('teenage readers');
    });
  });

  it('reports unknown references, missing level summaries, bad ids and stray files', async () => {
    await inFixture('phase3-bad', async () => {
      const { loadContentUncached } = await import('./load');
      const g = loadContentUncached();
      const msgs = g.errors.map((e) => `${path.basename(e.file)}: ${e.message}`);
      expect(msgs).toContain('broken.yaml: positions[0].evidence[0]: unknown source src.nobody-1999-nothing');
      expect(msgs).toContain('broken.yaml: relatedEntities: unknown entity person.ghost');
      expect(msgs).toContain('broken.yaml: relatedArticles: unknown article history/missing');
      expect(msgs).toContain('misnamed.yaml: positions: a debate needs at least two positions');
      expect(msgs).toContain('teen-gap.yaml: steps[0]: person.plain has no teen summary; every entity on a teen path needs one');
      expect(msgs).toContain('teen-gap.yaml: steps[1]: unknown entity person.nobody');
      expect(msgs).toContain('teen-gap.yaml: quiz[0] (q1): unknown source src.nobody-1999-nothing');
      expect(msgs.filter((m) => m.startsWith('notes.txt: unexpected file'))).toHaveLength(1);
      // The broken debate still loads (it is schema-valid), so content:validate reports it rather than dropping it.
      expect(g.debates.map((d) => d.id)).toEqual(['debate.broken']);
    });
  });
});

describe('native script and IAST language tags', () => {
  it('detects the dominant script', () => {
    expect(detectScript('अशोक')).toBe('Deva');
    expect(detectScript('இராஜராஜ சோழன்')).toBe('Taml');
    expect(detectScript('ಬಸವಣ್ಣ')).toBe('Knda');
    expect(detectScript('玄奘')).toBe('Hani');
    expect(detectScript('Aśoka')).toBeNull();
  });
  it('tags Devanagari as Sanskrit before 1200 CE and Hindi after, unless overridden', () => {
    expect(nativeLang('अशोक', { anchorYear: -260 })).toBe('sa-Deva');
    expect(nativeLang('कबीर', { anchorYear: 1450 })).toBe('hi');
    expect(nativeLang('शिवाजी', { anchorYear: 1650, override: 'mr' })).toBe('mr');
    expect(nativeLang('अशोक')).toBe('sa-Deva');
  });
  it('tells Persian from Arabic and tags other Indic scripts', () => {
    expect(nativeLang('علاء الدین خلجی')).toBe('fa');
    expect(nativeLang('أبو الريحان البيروني')).toBe('ar');
    expect(nativeLang('ଜୟଦେବ')).toBe('or');
    expect(nativeLang('Latin only')).toBe('und');
  });
  it('tags romanised names with the Latin script subtag of the native language', () => {
    expect(romanisedLang('sa-Deva')).toBe('sa-Latn');
    expect(romanisedLang('ta')).toBe('ta-Latn');
    expect(romanisedLang('und')).toBe('sa-Latn');
    expect(romanisedLang(undefined)).toBe('sa-Latn');
  });
  it('accepts a valid nativeLang override on entities and rejects a malformed one', () => {
    const e = {
      id: 'person.x',
      type: 'person',
      kind: 'person',
      summary: 'A fixture person used to test the name language override.',
      datings: [{ method: 'epigraphic', grade: 'A', range: { earliest: 1600, latest: 1650, precision: 'year', circa: true }, sources: ['src.a-2000-b'] }],
      review: { status: 'draft' },
    };
    expect(EntitySchema.safeParse({ ...e, names: { en: 'X', native: 'शिवाजी', nativeLang: 'mr' } }).success).toBe(true);
    expect(EntitySchema.safeParse({ ...e, names: { en: 'X', native: 'शिवाजी', nativeLang: 'Marathi' } }).success).toBe(false);
  });
});

describe('reading level', () => {
  it('parses and resolves levels with URL first, then storage, then adult', () => {
    expect(parseLevel('teen')).toBe('teen');
    expect(parseLevel('expert')).toBeNull();
    expect(parseLevel(null)).toBeNull();
    expect(resolveLevel('?level=kids', 'teen')).toBe('kids');
    expect(resolveLevel('?level=bogus', 'teen')).toBe('teen');
    expect(resolveLevel('', null)).toBe('adult');
  });
  it('falls back from simpler to fuller text, never the other way', () => {
    expect(shownLevel('kids', ['adult', 'teen'])).toBe('teen');
    expect(shownLevel('kids', ['adult'])).toBe('adult');
    expect(shownLevel('teen', ['adult', 'kids'])).toBe('adult');
    expect(shownLevel('adult', ['adult', 'teen', 'kids'])).toBe('adult');
  });

  function runBoot(search: string, storage: { getItem: (k: string) => string | null }) {
    const attrs = new Map<string, string>();
    const doc = { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) } };
    new Function('location', 'localStorage', 'document', READING_LEVEL_BOOT_SCRIPT)({ search }, storage, doc);
    return attrs.get(LEVEL_ATTRIBUTE);
  }

  it('boot script applies the URL level, then the stored level, and survives blocked storage', () => {
    const stored = (v: string | null) => ({ getItem: (k: string) => (k === LEVEL_STORAGE_KEY ? v : null) });
    expect(runBoot('?level=kids', stored('teen'))).toBe('kids');
    expect(runBoot('', stored('teen'))).toBe('teen');
    expect(runBoot('', stored('adult'))).toBeUndefined();
    expect(runBoot('?level=nonsense', stored('nonsense'))).toBeUndefined();
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(runBoot('', blocked)).toBeUndefined();
    expect(runBoot('?level=teen', blocked)).toBe('teen');
  });
});
