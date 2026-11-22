import type { ContentRecords } from './load';
import { ENTITY_TYPES, type EntityType } from './schema';

type ReviewGroup = EntityType | 'article';

interface ReviewItem {
  id: string;
  title: string;
  file: string;
}

export function reviewQueue(records: Pick<ContentRecords, 'entities' | 'articles'>): { type: ReviewGroup; items: ReviewItem[] }[] {
  const pending = (status: string) => status === 'draft' || status === 'machine-checked';
  const groups = new Map<ReviewGroup, ReviewItem[]>();
  const add = (type: ReviewGroup, item: ReviewItem) => {
    const items = groups.get(type) ?? [];
    items.push(item);
    groups.set(type, items);
  };
  for (const { data: entity, file } of records.entities) {
    if (pending(entity.review.status)) {
      add(entity.type, { id: entity.id, title: entity.names.en, file });
    }
  }
  for (const article of records.articles) {
    if (pending(article.review.status)) {
      add('article', { id: `${article.category}/${article.slug}`, title: article.title, file: article.file });
    }
  }
  return [...ENTITY_TYPES, 'article' as const].flatMap((type) => {
    const items = groups.get(type);
    return items ? [{ type, items: items.sort((a, b) => a.id.localeCompare(b.id)) }] : [];
  });
}

export function formatReviewQueue(records: Pick<ContentRecords, 'entities' | 'articles'>): string {
  const groups = reviewQueue(records);
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  if (!total) return 'awaiting_review: 0';
  return [
    `awaiting_review: ${total}`,
    ...groups.flatMap(({ type, items }) => [
      `${type}[${items.length}]{id,title,file}:`,
      ...items.map(({ id, title, file }) => `  ${[id, title, file].map((field) => JSON.stringify(field)).join(',')}`),
    ]),
  ].join('\n');
}
