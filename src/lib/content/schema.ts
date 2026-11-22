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
import { PRESENT_YEAR } from '../time';

import {
  PRECISIONS,
  GRADES,
  DATING_METHODS,
  ENTITY_TYPES,
  KINDS,
  isTraditional,
} from './labels';

export * from './labels';

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ENTITY_ID = new RegExp(`^(${ENTITY_TYPES.join('|')})\\.[a-z0-9]+(?:-[a-z0-9]+)*$`);
export const SOURCE_ID = /^src\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export const RELATION_KINDS = [
  'part-of',
  'authored',
  'authored-by',
  'ruled',
  'ruled-by',
  'patronised',
  'patronised-by',
  'succeeded',
  'preceded',
  'commented-on',
  'located-at',
  'excavated-at',
  'issued-by',
  'founded',
  'founded-by',
  'taught',
  'student-of',
  'influenced',
  'contemporary-of',
  'related-to',
] as const;

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

export const ReviewSchema = z
  .strictObject({
    status: z.enum(['draft', 'machine-checked', 'reviewed']),
    reviewer: z.string().nullable().default(null),
    lastReviewed: z.string().nullable().default(null),
    author: z.string().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.status === 'reviewed' && (!r.reviewer || !r.lastReviewed)) {
      ctx.addIssue({ code: 'custom', message: 'status reviewed requires reviewer and lastReviewed' });
    }
  });

export const ImageSchema = z.strictObject({
  commons: z.string().regex(/^File:.+/, 'use the Wikimedia Commons file title, e.g. File:Sanchi2.jpg'),
  alt: z.string().min(5),
  credit: z.string().min(2),
  license: z.string().min(2),
});

/** Wording that marks a dating as the date of a text rather than of the entity. */
const TEXT_DATE = /\b(?:date of the texts?|dates? the texts?)\b/i;

export const EntitySchema = z
  .strictObject({
    id: z.string().regex(ENTITY_ID),
    type: z.enum(ENTITY_TYPES),
    kind: z.enum(KINDS),
    names: z.strictObject({
      en: z.string().min(1),
      iast: z.string().optional(),
      native: z.string().optional(),
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

export const CATEGORIES = ['history', 'philosophy', 'science', 'literature', 'art-and-culture', 'music', 'language'] as const;

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

export { slug as SLUG };
