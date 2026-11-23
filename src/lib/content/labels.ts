/** Client-safe constants and labels (no zod import). */

export const PRECISIONS = ['day', 'year', 'decade', 'century', 'millennium', 'ka', 'Ma', 'cosmological'] as const;

export const GRADES = ['A', 'B', 'C', 'D', 'E'] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_LABELS: Record<Grade, string> = {
  A: 'Directly attested',
  B: 'Strong scholarly consensus',
  C: 'Reasoned estimate, debated',
  D: 'Traditional reckoning',
  E: 'Speculative or fringe',
};

export const TRADITIONAL_METHODS = ['traditional-puranic', 'traditional-siddhantic', 'traditional-sampradaya'] as const;

export const DATING_METHODS = [
  'archaeological-radiocarbon',
  'archaeological-stratigraphic',
  'luminescence',
  'epigraphic',
  'numismatic',
  'foreign-synchronism',
  'textual-internal',
  'linguistic',
  'astronomical-reference',
  'art-historical',
  'genetic',
  'geological',
  'documentary',
  'scholarly-consensus',
  ...TRADITIONAL_METHODS,
] as const;
export type DatingMethod = (typeof DATING_METHODS)[number];

export const METHOD_LABELS: Record<DatingMethod, string> = {
  'archaeological-radiocarbon': 'Radiocarbon dating',
  'archaeological-stratigraphic': 'Stratigraphy',
  luminescence: 'Luminescence dating',
  epigraphic: 'Inscription',
  numismatic: 'Coins',
  'foreign-synchronism': 'Foreign synchronism',
  'textual-internal': 'Internal textual evidence',
  linguistic: 'Linguistic dating',
  'astronomical-reference': 'Astronomical reference',
  'art-historical': 'Art-historical style',
  genetic: 'Genetic evidence',
  geological: 'Geological dating',
  documentary: 'Contemporary documents',
  'scholarly-consensus': 'Scholarly consensus',
  'traditional-puranic': 'Puranic reckoning',
  'traditional-siddhantic': 'Siddhantic reckoning',
  'traditional-sampradaya': 'Sampradaya tradition',
};

export function isTraditional(method: DatingMethod): boolean {
  return (TRADITIONAL_METHODS as readonly string[]).includes(method);
}

export const ENTITY_TYPES = ['event', 'person', 'text', 'site', 'polity', 'artifact', 'tradition', 'concept', 'cosmology'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Rings of the Kaalchakra wheel, innermost first. */
export const KINDS = [
  'cosmology',
  'prehistory',
  'civilisation',
  'polity',
  'text',
  'person',
  'science',
  'art',
  'dharma',
  'site',
  'event',
] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABELS: Record<Kind, string> = {
  cosmology: 'Cosmology',
  prehistory: 'Prehistory',
  civilisation: 'Civilisations',
  polity: 'Dynasties and states',
  text: 'Texts',
  person: 'People',
  science: 'Science and mathematics',
  art: 'Arts and architecture',
  dharma: 'Dharma traditions',
  site: 'Sites',
  event: 'Events',
};


/** Article categories, one directory each under _content/. */
export const CATEGORIES = ['history', 'philosophy', 'science', 'literature', 'art-and-culture', 'music', 'language'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  history: 'History',
  philosophy: 'Philosophy',
  science: 'Science',
  literature: 'Literature',
  'art-and-culture': 'Art and Culture',
  music: 'Music',
  language: 'Language',
};

/**
 * Relation kinds. A relation always reads as a sentence with the entity that declares it as the
 * subject: "<this entity> <kind> <target>".
 */
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
export type RelationKind = (typeof RELATION_KINDS)[number];

/** Kinds that mean the same in both directions: "A contemporary-of B" is "B contemporary-of A". */
export const SYMMETRIC_RELATIONS: readonly RelationKind[] = ['contemporary-of', 'related-to'];

/** Kinds with a named inverse: "A ruled B" is "B ruled-by A". Listed in both directions. */
export const RELATION_INVERSE: Partial<Record<RelationKind, RelationKind>> = {
  authored: 'authored-by',
  'authored-by': 'authored',
  ruled: 'ruled-by',
  'ruled-by': 'ruled',
  patronised: 'patronised-by',
  'patronised-by': 'patronised',
  succeeded: 'preceded',
  preceded: 'succeeded',
  founded: 'founded-by',
  'founded-by': 'founded',
  taught: 'student-of',
  'student-of': 'taught',
};

/**
 * Kinds that cannot hold in both directions between the same two entities: nothing is part of its own
 * part, and nobody succeeds their own successor. Mutual influence and mutual commentary are possible,
 * so those kinds are not listed.
 */
export const ONE_WAY_RELATIONS: readonly RelationKind[] = [
  'part-of',
  'authored',
  'authored-by',
  'ruled',
  'ruled-by',
  'patronised',
  'patronised-by',
  'succeeded',
  'preceded',
  'located-at',
  'excavated-at',
  'issued-by',
  'founded',
  'founded-by',
  'taught',
  'student-of',
];

/** Phrase for an outgoing relation, read as "<this entity> <phrase> <target>". */
export const RELATION_LABELS: Record<RelationKind, string> = {
  'part-of': 'part of',
  authored: 'authored',
  'authored-by': 'authored by',
  ruled: 'ruled',
  'ruled-by': 'ruled by',
  patronised: 'patronised',
  'patronised-by': 'patronised by',
  succeeded: 'succeeded',
  preceded: 'preceded',
  'commented-on': 'commented on',
  'located-at': 'located at',
  'excavated-at': 'excavated at',
  'issued-by': 'issued by',
  founded: 'founded',
  'founded-by': 'founded by',
  taught: 'taught',
  'student-of': 'student of',
  influenced: 'influenced',
  'contemporary-of': 'contemporary of',
  'related-to': 'related to',
};

/**
 * Phrase for an incoming relation seen from its target, read as "<this entity> <phrase> <source>".
 * "X part-of this" becomes "this includes X".
 */
export const RELATION_INBOUND_LABELS: Record<RelationKind, string> = {
  'part-of': 'includes',
  authored: 'authored by',
  'authored-by': 'authored',
  ruled: 'ruled by',
  'ruled-by': 'ruled',
  patronised: 'patronised by',
  'patronised-by': 'patronised',
  succeeded: 'preceded',
  preceded: 'succeeded',
  'commented-on': 'commented on by',
  'located-at': 'location of',
  'excavated-at': 'find place of',
  'issued-by': 'issued',
  founded: 'founded by',
  'founded-by': 'founded',
  taught: 'student of',
  'student-of': 'taught',
  influenced: 'influenced by',
  'contemporary-of': 'contemporary of',
  'related-to': 'related to',
};

/** Reading levels, fullest first. Summaries: adult = `summary`, teen = `summaries.teen`, kids = `summaries.kids`. */
export const READING_LEVELS = ['adult', 'teen', 'kids'] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number];

export const READING_LEVEL_LABELS: Record<ReadingLevel, string> = {
  adult: 'Full',
  teen: 'Teen',
  kids: 'Kids',
};

export const READING_LEVEL_AUDIENCE: Record<ReadingLevel, string> = {
  adult: 'Adults and researchers',
  teen: 'Ages 13 to 17',
  kids: 'Ages 8 to 12',
};

/**
 * Editorial review states. `draft` (and the legacy `machine-checked`) await a human editor; `reviewed`
 * records the editor's sign-off; `published` is a reviewed revision that has been released.
 */
export const REVIEW_STATUSES = ['draft', 'machine-checked', 'reviewed', 'published'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** True while a record still needs a human editor's sign-off. */
export function awaitingReview(status: ReviewStatus): boolean {
  return status === 'draft' || status === 'machine-checked';
}

/** The review status as one clause, for the "Review status:" line on entity and article pages. */
export function reviewStatusText(review: { status: ReviewStatus; reviewer: string | null; lastReviewed: string | null }): string {
  switch (review.status) {
    case 'published':
      return `published after review by ${review.reviewer} on ${review.lastReviewed}`;
    case 'reviewed':
      return `reviewed by ${review.reviewer} on ${review.lastReviewed}`;
    case 'machine-checked':
      return 'citations machine-checked, awaiting editor review';
    case 'draft':
      return 'draft, identifiers machine-verified, awaiting editor review';
  }
}
