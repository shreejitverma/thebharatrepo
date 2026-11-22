import type { ContentRecords } from './load';
import { ENTITY_TYPES, awaitingReview, type EntityType } from './labels';

type ReviewGroup = EntityType | 'article' | 'debate' | 'learning-path';

type QueueRecords = Pick<ContentRecords, 'entities' | 'articles'> & Partial<Pick<ContentRecords, 'debates' | 'learningPaths'>>;

interface ReviewItem {
  id: string;
  title: string;
  file: string;
}

/**
 * Everything still waiting for a person: records whose review status awaits an editor, and every debate that
 * is not published, since a debate also needs the owner's approval before it can appear anywhere.
 */
export function reviewQueue(records: QueueRecords): { type: ReviewGroup; items: ReviewItem[] }[] {
  const groups = new Map<ReviewGroup, ReviewItem[]>();
  const add = (type: ReviewGroup, item: ReviewItem) => {
    const items = groups.get(type) ?? [];
    items.push(item);
    groups.set(type, items);
  };
  for (const { data: entity, file } of records.entities) {
    if (awaitingReview(entity.review.status)) {
      add(entity.type, { id: entity.id, title: entity.names.en, file });
    }
  }
  for (const article of records.articles) {
    if (awaitingReview(article.review.status)) {
      add('article', { id: `${article.category}/${article.slug}`, title: article.title, file: article.file });
    }
  }
  for (const debate of records.debates ?? []) {
    if (!debate.published || awaitingReview(debate.review.status)) {
      add('debate', { id: debate.id, title: debate.published ? debate.title : `${debate.title} (unpublished, awaiting owner approval)`, file: debate.file });
    }
  }
  for (const lp of records.learningPaths ?? []) {
    if (awaitingReview(lp.review.status)) add('learning-path', { id: lp.id, title: lp.title, file: lp.file });
  }
  return [...ENTITY_TYPES, 'article' as const, 'debate' as const, 'learning-path' as const].flatMap((type) => {
    const items = groups.get(type);
    return items ? [{ type, items: items.sort((a, b) => a.id.localeCompare(b.id)) }] : [];
  });
}

export function formatReviewQueue(records: QueueRecords): string {
  const groups = reviewQueue(records);
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  if (!total) return 'awaiting_review: 0';
  return [
    `awaiting_review: ${total}`,
    ...groups.flatMap(({ type, items }) => [
      `${type}[${items.length}]{id,title,file}:`,
      ...items.map(({ id, title, file }) => `  ${[id, title, file].map((field) => JSON.stringify(field)).join(',')}`),
    ]),
    'help: After checking a record, set review.status to reviewed with reviewer and lastReviewed (docs/editorial/STYLE.md, section 10).',
    ...(groups.some((g) => g.type === 'debate') ? ['help: A debate is published only by the owner: set published to true with approval { by, date } (docs/editorial/STYLE.md, section 12).'] : []),
  ].join('\n');
}
