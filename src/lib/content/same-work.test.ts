import { describe, expect, it } from 'vitest';
import { sameWork } from './load';
import { SourceSchema } from './schema';

const src = (o: Record<string, unknown>) => SourceSchema.parse({ id: 'src.x-2000-x', type: 'book', ...o });

describe('sameWork', () => {
  it('keeps two editions of one work by the same authors together', () => {
    const a = src({ title: 'Modern South Asia: History, Culture, Political Economy', authors: ['Sugata Bose', 'Ayesha Jalal'], doi: '10.4324/9780203712535' });
    const b = src({ title: 'Modern South Asia: History, Culture, Political Economy', authors: ['Sugata Bose', 'Ayesha Jalal'], isbn: '9781032124186' });
    expect(sameWork(a, b)).toBe(true);
  });

  it('separates similar titles by different authors', () => {
    const a = src({ title: "The 'Early Medieval' Origins of India", authors: ['Manu V. Devadevan'], doi: '10.1017/9781108494571' });
    const b = src({ title: 'Early India: From the Origins to AD 1300', authors: ['Romila Thapar'], oclc: '55661068' });
    expect(sameWork(a, b)).toBe(false);
  });

  it('separates an authored book from an institutional page with a similar title', () => {
    const a = src({ title: 'Kutiyattam: Sanskrit Theater of India', authors: ['Farley Richmond'], doi: '10.3998/mpub.6558' });
    const b = src({ type: 'web', title: 'Kutiyattam, Sanskrit theatre', publisher: 'UNESCO', url: 'https://ich.unesco.org/en/RL/kutiyattam-sanskrit-theatre-00010' });
    expect(sameWork(a, b)).toBe(false);
  });

  it('separates two Google Books volumes that differ only in their id parameter', () => {
    const a = src({ title: 'Indian Round Table Conference (Second Session)', authors: ['Great Britain. India Office'], url: 'https://books.google.com/books?id=xXsZAQAAIAAJ' });
    const b = src({ title: 'Indian Round Table Conference (Third Session)', authors: ['Great Britain. India Office'], url: 'https://books.google.com/books?id=OHsZAQAAIAAJ' });
    expect(sameWork(a, b)).toBe(false);
  });
});
