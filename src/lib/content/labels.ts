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
