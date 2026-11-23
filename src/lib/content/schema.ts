/**
 * Content schemas for The Bharat Repo.
 *
 * The rules encoded here are the editorial contract:
 * - every entity has at least one dating,
 * - every dating and every claim cites at least one source,
 * - traditional reckoning is always grade D and always shown in the Tradition lens,
 * - grade D is never used for non-traditional methods.
 */

import { z } from 'zod';
import { PRESENT_YEAR, formatRange } from '../time';
import { rankDatings } from './lens';

import {
  PRECISIONS,
  GRADES,
  DATING_METHODS,
  ENTITY_TYPES,
  KINDS,
  RELATION_KINDS,
  READING_LEVELS,
  CATEGORIES,
  REVIEW_STATUSES,
  isTraditional,
} from './labels';

export * from './labels';

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ENTITY_ID = new RegExp(`^(${ENTITY_TYPES.join('|')})\\.[a-z0-9]+(?:-[a-z0-9]+)*$`);
export const SOURCE_ID = /^src\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Language tag: language, optional script, optional region ("sa-Deva", "hi", "ta-Latn", "zh-Hant"). */
export const BCP47 = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?$/;

export const CitationRef = z.union([
  z.string().regex(SOURCE_ID, 'source ids look like src.author-year-short-title'),
  z.strictObject({
    id: z.string().regex(SOURCE_ID),
    locator: z.string().min(1).optional(),
  }),
]);
export type CitationRef = z.infer<typeof CitationRef>;

export function citationId(ref: CitationRef): string {
  return typeof ref === 'string' ? ref : ref.id;
}

/**
 * A year is either an astronomical year number, or a human-readable string that is converted here so
 * authors never do BCE arithmetic: "7000 BCE", "320 CE", "1947", "385 ka", "1.5 Ma", "1.97 Ga".
 */
export function parseYear(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().replace(/,/g, '');
  let m = /^(\d+(?:\.\d+)?)\s*(BCE|BC)$/i.exec(s);
  if (m) return 1 - Number(m[1]);
  m = /^(\d+(?:\.\d+)?)\s*(CE|AD)?$/i.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d+(?:\.\d+)?)\s*(ka|Ma|Ga)$/.exec(s);
  if (m) return PRESENT_YEAR - Math.round(Number(m[1]) * { ka: 1e3, Ma: 1e6, Ga: 1e9 }[m[2] as 'ka' | 'Ma' | 'Ga']);
  return v;
}

const Year = z.preprocess(parseYear, z.number({ message: 'year must be a number or a string like "7000 BCE", "320 CE", "385 ka", "1.5 Ma"' }).finite());

export const YearRangeSchema = z
  .strictObject({
    earliest: Year,
    latest: Year,
    best: Year.optional(),
    precision: z.enum(PRECISIONS),
    circa: z.boolean({ message: 'circa is required: true for any estimate' }),
  })
  .superRefine((r, ctx) => {
    if (r.earliest > r.latest) ctx.addIssue({ code: 'custom', message: `earliest (${r.earliest}) is after latest (${r.latest})` });
    if (r.best !== undefined && (r.best < r.earliest || r.best > r.latest)) {
      ctx.addIssue({ code: 'custom', message: `best (${r.best}) is outside [earliest, latest]` });
    }
    if (r.latest > 2100) ctx.addIssue({ code: 'custom', message: 'datings after 2100 CE are not history' });
  });

export const DatingSchema = z
  .strictObject({
    method: z.enum(DATING_METHODS),
    range: YearRangeSchema,
    grade: z.enum(GRADES),
    label: z.string().optional(),
    sources: z.array(CitationRef).min(1, 'every dating needs at least one source'),
    note: z.string().optional(),
    /**
     * Why this dating stands for the entity although a dating of it at least five times longer exists: for example a
     * competing dating of the same deposit, or the foundation that the later building phases follow. Without it the
     * validator treats such a dating as a single event in the entity's history, which belongs in a claim.
     */
    primaryReason: z.string().min(10).optional(),
  })
  .superRefine((d, ctx) => {
    const trad = isTraditional(d.method);
    if (trad && d.grade !== 'D') ctx.addIssue({ code: 'custom', message: `traditional method ${d.method} must be grade D` });
    if (!trad && d.grade === 'D') ctx.addIssue({ code: 'custom', message: `grade D is reserved for traditional methods, not ${d.method}` });
    if (d.range.precision === 'cosmological' && !trad) {
      ctx.addIssue({ code: 'custom', message: 'cosmological precision is only for traditional reckoning' });
    }
  });
export type Dating = z.infer<typeof DatingSchema>;

export const ClaimSchema = z.strictObject({
  text: z.string().min(10),
  grade: z.enum(GRADES),
  sources: z.array(CitationRef).min(1, 'every claim needs at least one source'),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const RelationSchema = z.strictObject({
  kind: z.enum(RELATION_KINDS),
  target: z.string().regex(ENTITY_ID),
  note: z.string().optional(),
});

export const LocationSchema = z.strictObject({
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

/**
 * Approximate territorial extent of an entity, usually a polity, for the Map view. Optional: the map
 * draws an extent only where one has been authored, and an extent is a claim like any other, so it
 * carries a grade and at least one source.
 */
export const ExtentSchema = z
  .strictObject({
    /** Names the extent when an entity has several, for example "Under Ashoka, c. 250 BCE". */
    label: z.string().min(1).optional(),
    /** When the extent applies. Omit both to use the entity's own datings. */
    from: Year.optional(),
    to: Year.optional(),
    /** One closed ring of [longitude, latitude] vertices; the last vertex joins the first. */
    polygon: z
      .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
      .min(3, 'an extent polygon needs at least three [lon, lat] vertices')
      .max(400, 'keep an extent polygon to 400 vertices; it is an approximation'),
    grade: z.enum(GRADES),
    sources: z.array(CitationRef).min(1, 'every extent needs at least one source'),
    note: z.string().optional(),
  })
  .superRefine((x, ctx) => {
    if ((x.from === undefined) !== (x.to === undefined)) ctx.addIssue({ code: 'custom', message: 'give both from and to, or neither' });
    if (x.from !== undefined && x.to !== undefined && x.from > x.to) ctx.addIssue({ code: 'custom', message: `from (${x.from}) is after to (${x.to})` });
  });
export type Extent = z.infer<typeof ExtentSchema>;

export const ReviewSchema = z
  .strictObject({
    status: z.enum(REVIEW_STATUSES),
    reviewer: z.string().nullable().default(null),
    lastReviewed: z.string().nullable().default(null),
    author: z.string().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.status === 'reviewed' || r.status === 'published') {
      if (!r.reviewer?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['reviewer'], message: `status ${r.status} requires the human reviewer's name` });
      }
      if (!z.iso.date().safeParse(r.lastReviewed).success) {
        ctx.addIssue({ code: 'custom', path: ['lastReviewed'], message: `status ${r.status} requires a review date in YYYY-MM-DD format` });
      }
    }
  });

export const ImageSchema = z.strictObject({
  commons: z.string().regex(/^File:.+/, 'use the Wikimedia Commons file title, e.g. File:Sanchi2.jpg'),
  alt: z.string().min(5),
  credit: z.string().min(2),
  license: z.string().min(2),
});

/** How many times longer than the leading dating another dating must be for the leading one to read as a single event. */
const EVENT_SPAN_RATIO = 5;

/**
 * The scholarship dating that ranks first stands for the entity everywhere (see rankDatings). A dating describes the
 * entity's own existence, so when the leading dating is at most a fifth as long as another dating of the entity, inside
 * or outside it, it reads as one event in the entity's history (a speech, a capture, an inscription, the completion of
 * one work) and the item would be labelled and sorted by it. Returns that event and the longer dating, unless the
 * leading dating gives a primaryReason.
 */
function eventOutrankingSpan(datings: readonly Dating[]): { event: Dating; span: Dating } | null {
  const scholarly = datings.filter((d) => !isTraditional(d.method));
  const [event] = rankDatings(scholarly, () => false);
  if (!event || event.primaryReason) return null;
  const years = (d: Dating) => d.range.latest - d.range.earliest + 1;
  const span = scholarly.find((d) => d !== event && years(d) >= EVENT_SPAN_RATIO * years(event));
  return span ? { event, span } : null;
}

/** Wording that marks a dating as the date of a text, or of a text's statement or attestation, rather than of the entity. */
const TEXT_DATE = /\b(?:date of the texts?|dates? the texts?|earliest (?:known )?(?:statement|mention|attestation|reference)|first (?:attested|stated|mentioned) in)\b/i;

export const EntitySchema = z
  .strictObject({
    id: z.string().regex(ENTITY_ID),
    type: z.enum(ENTITY_TYPES),
    kind: z.enum(KINDS),
    names: z.strictObject({
      en: z.string().min(1),
      iast: z.string().optional(),
      native: z.string().optional(),
      /** BCP 47 tag for `native` when the script default is wrong, e.g. "mr" for a Marathi name in Devanagari. */
      nativeLang: z.string().regex(BCP47, 'a BCP 47 tag such as "hi", "mr", "sa-Deva" or "ta"').optional(),
      /**
       * Other names a reader searches by, such as "Buddha" for Gautama Buddha. Search pins the entity first when a
       * query is exactly one of them (or its title, or its IAST name), so add only a name that means this entity.
       */
      alternates: z.array(z.string().min(1)).optional(),
    }),
    summary: z.string().min(20).max(600),
    summaries: z
      .object({
        kids: z.string().min(20).max(400).optional(),
        teen: z.string().min(20).max(500).optional(),
      })
      .optional(),
    region: z.string().optional(),
    location: LocationSchema.optional(),
    extents: z.array(ExtentSchema).optional(),
    datings: z.array(DatingSchema).min(1, 'every entity needs at least one dating'),
    claims: z.array(ClaimSchema).default([]),
    relations: z.array(RelationSchema).default([]),
    /**
     * Former ids of entities merged into this one. Each alias keeps its old URLs working: the build turns it
     * into permanent redirects from /archive/<type>/<slug> and /kaalchakra?id=<id> to this entity.
     */
    aliases: z.array(z.string().regex(ENTITY_ID, 'an alias is a former entity id, such as concept.old-slug')).default([]),
    wikidata: z.string().regex(/^Q\d+$/).nullable().optional(),
    image: ImageSchema.optional(),
    debate: z.string().optional(),
    tags: z.array(z.string()).default([]),
    review: ReviewSchema,
  })
  .superRefine((e, ctx) => {
    if (!e.id.startsWith(`${e.type}.`)) ctx.addIssue({ code: 'custom', message: `id ${e.id} must start with "${e.type}."` });
    if (e.type === 'cosmology' && e.datings.some((d) => !isTraditional(d.method))) {
      ctx.addIssue({ code: 'custom', message: 'cosmology entities may only carry traditional datings' });
    }
    // A dating places the entity itself. For a figure or event known only from tradition, the date of the texts
    // that tell of it is evidence about those texts: it belongs on the text entity or in a claim, or the marker
    // reads as a scholarly date for the figure.
    e.datings.forEach((d, i) => {
      if (e.type !== 'text' && !isTraditional(d.method) && TEXT_DATE.test(`${d.label ?? ''} ${d.note ?? ''}`)) {
        ctx.addIssue({ code: 'custom', path: ['datings', i], message: `this ${d.method} dating dates a text, not ${e.id}; record the attestation as a claim or on the text entity` });
      }
    });
    const outranking = eventOutrankingSpan(e.datings);
    if (outranking) {
      const { event, span } = outranking;
      ctx.addIssue({
        code: 'custom',
        path: ['datings', e.datings.indexOf(event)],
        message: `the grade ${event.grade} ${event.method} dating ${formatRange(event.range)} would stand for ${e.id}, but the grade ${span.grade} dating ${formatRange(span.range)} is at least ${EVENT_SPAN_RATIO} times longer; record that event as a claim and keep the span as the dating, or give a primaryReason when the shorter dating dates the entity itself`,
      });
    }
    if (e.aliases.includes(e.id)) ctx.addIssue({ code: 'custom', path: ['aliases'], message: `alias ${e.id} is the entity's own id` });
    const seen = new Set<string>();
    for (const a of e.aliases) {
      if (seen.has(a)) ctx.addIssue({ code: 'custom', path: ['aliases'], message: `alias ${a} is listed twice` });
      seen.add(a);
    }
  });
export type Entity = z.infer<typeof EntitySchema>;

export const SOURCE_TYPES = [
  'primary-text',
  'translation',
  'inscription',
  'excavation-report',
  'coin-catalogue',
  'manuscript',
  'foreign-account',
  'journal-article',
  'book',
  'book-chapter',
  'reference-work',
  'museum-record',
  'dataset',
  'government-record',
  'web',
] as const;

export const SourceSchema = z
  .strictObject({
    id: z.string().regex(SOURCE_ID),
    type: z.enum(SOURCE_TYPES),
    title: z.string().min(3),
    authors: z.array(z.string().min(2)).default([]),
    editors: z.array(z.string().min(2)).default([]),
    year: z.number().int().optional(),
    publisher: z.string().optional(),
    journal: z.string().optional(),
    volume: z.string().optional(),
    pages: z.string().optional(),
    doi: z
      .string()
      .regex(/^10\.\d{4,9}\/\S+$/, 'bare DOI without https://doi.org/')
      .optional(),
    isbn: z
      .string()
      .regex(/^(97[89])?\d{9}[\dX]$/, 'ISBN-10 or ISBN-13 digits only, no hyphens')
      .optional(),
    oclc: z.string().regex(/^\d+$/).optional(),
    url: z.string().url().optional(),
    corpus: z.string().optional(),
    note: z.string().optional(),
  })
  .superRefine((s, ctx) => {
    if (s.type === 'journal-article' && !s.doi && !s.url) {
      ctx.addIssue({ code: 'custom', message: 'journal articles need a DOI (or a stable URL such as JSTOR for pre-DOI articles)' });
    }
    if ((s.type === 'book' || s.type === 'book-chapter' || s.type === 'translation' || s.type === 'reference-work') && !s.isbn && !s.oclc && !s.url && !s.doi) {
      ctx.addIssue({ code: 'custom', message: 'books need an ISBN, OCLC number, DOI or stable URL (e.g. archive.org)' });
    }
    if (!s.doi && !s.isbn && !s.oclc && !s.url) {
      ctx.addIssue({ code: 'custom', message: 'every source needs a verifiable identifier: doi, isbn, oclc or url' });
    }
    if (s.authors.length === 0 && s.editors.length === 0 && !s.publisher && !s.corpus) {
      ctx.addIssue({ code: 'custom', message: 'a source needs authors, editors, a publisher or a corpus' });
    }
  });
export type Source = z.infer<typeof SourceSchema>;

export const ArticleFrontmatterSchema = z.strictObject({
  title: z.string().min(3),
  summary: z.string().min(20).max(400),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tags: z.array(z.string()).default([]),
  /** The article's own placement in time. */
  datings: z.array(DatingSchema).min(1, 'every article needs a place in time'),
  /** Entities this article is about; each must exist. */
  entities: z.array(z.string().regex(ENTITY_ID)).default([]),
  readingLevel: z.enum(['kids', 'teen', 'adult']).default('adult'),
  review: ReviewSchema,
});
export type ArticleFrontmatter = z.infer<typeof ArticleFrontmatterSchema>;

export const CorrectionSchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  target: z.string().min(1),
  before: z.string().min(1),
  after: z.string().min(1),
  reason: z.string().min(10),
  sources: z.array(CitationRef).default([]),
});
export type Correction = z.infer<typeof CorrectionSchema>;


/* ---------- Debates (content/debates/<slug>.yaml) ---------- */

export const DEBATE_ID = /^debate\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** An article reference: "<category>/<slug>", for example "history/maurya-empire". */
export const ARTICLE_REF = new RegExp(`^(${CATEGORIES.join('|')})/[a-z0-9]+(?:-[a-z0-9]+)*$`);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A citation that must say where in the source the evidence is: page, chapter, verse, edict or figure. */
export const LocatedCitation = z.strictObject({
  id: z.string().regex(SOURCE_ID, 'source ids look like src.author-year-short-title'),
  locator: z.string().min(1, 'debate evidence needs a locator (page, chapter, verse, edict, figure)'),
});
export type LocatedCitation = z.infer<typeof LocatedCitation>;

export const ProponentSchema = z.strictObject({
  /** A named person (or a named tradition such as "Theravada chronicle tradition"). */
  name: z.string().min(3),
  /** One line on who they are, for example "Indologist, editor of the Gottingen symposium volumes". */
  role: z.string().min(3).optional(),
  /** Their own statement of the position, when it is in the bibliography. */
  work: CitationRef.optional(),
});

export const EvidenceSchema = z.strictObject({
  text: z.string().min(20),
  grade: z.enum(GRADES),
  sources: z.array(LocatedCitation).min(1, 'every evidence item needs at least one source with a locator'),
});

export const PositionSchema = z
  .strictObject({
    id: z.string().regex(slug, 'position ids are slugs, e.g. long-chronology'),
    label: z.string().min(3),
    /** Scholarship or Tradition. Tradition positions are grade D, as datings are. */
    lens: z.enum(['scholarship', 'tradition']),
    /** The position at its strongest, in the words a proponent would accept. */
    statement: z.string().min(40).max(1500),
    /** Overall standing of the position's evidence. */
    grade: z.enum(GRADES),
    /** The range this position proposes, when it proposes one; drawn on the debate's timeline. */
    range: YearRangeSchema.optional(),
    proponents: z.array(ProponentSchema).min(1, 'every position needs at least one named proponent'),
    evidence: z.array(EvidenceSchema).min(1, 'every position needs at least one cited evidence item'),
    /** The strongest objections the position has to answer. */
    objections: z.array(z.string().min(10)).default([]),
  })
  .superRefine((p, ctx) => {
    if (p.lens === 'tradition' && p.grade !== 'D') ctx.addIssue({ code: 'custom', message: `tradition position ${p.id} must be grade D` });
    if (p.lens === 'scholarship' && p.grade === 'D') ctx.addIssue({ code: 'custom', message: `grade D is reserved for tradition positions, not ${p.id}` });
  });
export type DebatePosition = z.infer<typeof PositionSchema>;

export const DebateSchema = z
  .strictObject({
    id: z.string().regex(DEBATE_ID, 'debate ids look like debate.<slug>'),
    title: z.string().min(3),
    question: z.string().min(10).regex(/\?$/, 'the question ends with a question mark'),
    summary: z.string().min(20).max(1200),
    /**
     * Owner rule: no debate page is published without owner approval. Unpublished debates are validated
     * but excluded from the static build, the sitemap, search and every link.
     */
    published: z.boolean().default(false),
    approval: z.strictObject({ by: z.string().min(2), date: z.string().regex(ISO_DATE), note: z.string().optional() }).optional(),
    /** Evidence every position accepts, shown before the positions. */
    commonGround: z.array(EvidenceSchema).default([]),
    positions: z.array(PositionSchema).min(2, 'a debate needs at least two positions'),
    whatWouldChangeThis: z.array(z.string().min(20)).min(1, 'say what evidence would change the picture'),
    relatedEntities: z.array(z.string().regex(ENTITY_ID)).min(1, 'a debate is placed in time through at least one related entity'),
    relatedArticles: z.array(z.string().regex(ARTICLE_REF, 'article references look like history/maurya-empire')).default([]),
    tags: z.array(z.string()).default([]),
    review: ReviewSchema,
  })
  .superRefine((d, ctx) => {
    if (d.published && !d.approval) ctx.addIssue({ code: 'custom', path: ['approval'], message: 'published debates need owner approval: add approval { by, date }' });
    const ids = d.positions.map((p) => p.id);
    for (const id of ids.filter((x, i) => ids.indexOf(x) !== i)) ctx.addIssue({ code: 'custom', path: ['positions'], message: `duplicate position id ${id}` });
  });
export type Debate = z.infer<typeof DebateSchema>;

/* ---------- Learning paths and quizzes (content/learning/<slug>.yaml) ---------- */

export const LEARNING_ID = /^learn\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const LearningStepSchema = z
  .strictObject({
    entity: z.string().regex(ENTITY_ID).optional(),
    article: z.string().regex(ARTICLE_REF, 'article references look like history/maurya-empire').optional(),
    /** Heading for the step; defaults to the entity name or article title. */
    title: z.string().min(3).optional(),
    /** What to look for in this step, written at the path's reading level. */
    note: z.string().min(20).max(600),
  })
  .superRefine((s, ctx) => {
    if (Boolean(s.entity) === Boolean(s.article)) ctx.addIssue({ code: 'custom', message: 'a step references exactly one of entity or article' });
  });
export type LearningStep = z.infer<typeof LearningStepSchema>;

const TRICK_CHOICE = /^(all|none|both|neither) of (the )?(above|these|them)\.?$/i;

export const QuizChoiceSchema = z.strictObject({
  text: z.string().min(1),
  correct: z.boolean().default(false),
  /** Why this choice is right, or why it is wrong. Every choice is explained. */
  explanation: z.string().min(10),
});

export const QuizQuestionSchema = z
  .strictObject({
    id: z.string().regex(slug, 'question ids are slugs, e.g. q1 or edict-xiii'),
    question: z.string().min(10),
    choices: z.array(QuizChoiceSchema).min(2).max(5),
    /** Sources that support the correct answer. */
    sources: z.array(CitationRef).min(1, 'every correct answer must be supported by a cited source'),
  })
  .superRefine((q, ctx) => {
    const correct = q.choices.filter((c) => c.correct).length;
    if (correct !== 1) ctx.addIssue({ code: 'custom', path: ['choices'], message: `exactly one choice is correct (found ${correct})` });
    const texts = q.choices.map((c) => c.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) ctx.addIssue({ code: 'custom', path: ['choices'], message: 'choices must be distinct' });
    for (const c of q.choices) {
      if (TRICK_CHOICE.test(c.text.trim())) ctx.addIssue({ code: 'custom', path: ['choices'], message: `no trick questions: "${c.text}" is not allowed` });
    }
    if (/\b(NOT|EXCEPT|NEVER)\b/.test(q.question)) ctx.addIssue({ code: 'custom', path: ['question'], message: 'no trick questions: ask what is true, not which option is NOT' });
  });
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const LearningPathSchema = z
  .strictObject({
    id: z.string().regex(LEARNING_ID, 'learning path ids look like learn.<slug>'),
    title: z.string().min(3),
    level: z.enum(READING_LEVELS),
    /** Who the path is for, in a phrase: "Ages 13 to 17, in class or at home". */
    audience: z.string().min(3),
    summary: z.string().min(20).max(600),
    /** Where the path sits on the Kaalchakra when its steps span more than its subject (for example a modern decipherment of an ancient script). */
    focus: YearRangeSchema.optional(),
    goals: z.array(z.string().min(10)).min(1, 'say what the learner will be able to do'),
    steps: z.array(LearningStepSchema).min(2, 'a path has at least two steps'),
    quiz: z.array(QuizQuestionSchema).default([]),
    tags: z.array(z.string()).default([]),
    review: ReviewSchema,
  })
  .superRefine((p, ctx) => {
    const refs = p.steps.map((s) => s.entity ?? s.article);
    for (const r of refs.filter((x, i) => refs.indexOf(x) !== i)) ctx.addIssue({ code: 'custom', path: ['steps'], message: `step ${r} appears twice` });
    const ids = p.quiz.map((q) => q.id);
    for (const id of ids.filter((x, i) => ids.indexOf(x) !== i)) ctx.addIssue({ code: 'custom', path: ['quiz'], message: `duplicate question id ${id}` });
    // Choices are shown in the order written, so a quiz whose answer always sits in one slot gives itself away.
    const slots = new Set(p.quiz.map((q) => q.choices.findIndex((c) => c.correct)));
    if (p.quiz.length >= 3 && slots.size === 1) {
      ctx.addIssue({ code: 'custom', path: ['quiz'], message: `every correct answer is choice ${[...slots][0] + 1}; vary where the correct answer sits` });
    }
  });
export type LearningPath = z.infer<typeof LearningPathSchema>;

export { slug as SLUG };
