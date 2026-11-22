import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readContentRecords } from './load';
import { formatReviewQueue, reviewQueue } from './review-queue';
import { ReviewSchema } from './schema';

const fixture = path.join(__dirname, '__fixtures__/ok');

describe('review queue', () => {
  it('groups drafts and legacy machine-checked records by type and excludes reviewed and published entries', () => {
    const { records, errors } = readContentRecords([path.join(fixture, 'content')], path.join(fixture, '_content'));
    expect(errors).toEqual([]);
    records.entities[0].data.review = ReviewSchema.parse({ status: 'machine-checked' });
    records.entities[1].data.review = ReviewSchema.parse({ status: 'reviewed', reviewer: 'Test Editor', lastReviewed: '2026-11-22' });
    const published = { ...records.articles[0], slug: 'published', review: ReviewSchema.parse({
      status: 'published', reviewer: 'Test Editor', lastReviewed: '2026-11-22',
    }) };
    records.articles.push(published);

    expect(reviewQueue(records).map(({ type, items }) => [type, items.map(({ id }) => id)])).toEqual([
      ['event', ['event.thing']],
      ['article', ['history/fixture']],
    ]);
    expect(formatReviewQueue(records)).toMatch(/^awaiting_review: 2\nevent\[1\]\{id,title,file\}:\n/);
  });

  it('reports an explicit zero when the queue is empty', () => {
    expect(formatReviewQueue({ entities: [], articles: [] })).toBe('awaiting_review: 0');
  });

  it.each(['reviewed', 'published'])('requires a human reviewer and a calendar date for %s', (status) => {
    expect(ReviewSchema.safeParse({ status }).success).toBe(false);
    expect(ReviewSchema.safeParse({ status, reviewer: ' ', lastReviewed: '2026-11-22' }).success).toBe(false);
    expect(ReviewSchema.safeParse({ status, reviewer: 'Test Editor', lastReviewed: '2026-02-30' }).success).toBe(false);
    expect(ReviewSchema.safeParse({ status, reviewer: 'Test Editor', lastReviewed: '2026-11-22' }).success).toBe(true);
  });
});
