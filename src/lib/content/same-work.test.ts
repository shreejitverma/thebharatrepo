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

  it('separates a numbered volume from the unnumbered first book of a series by the same author', () => {
    const a = src({ title: "The Ubiquitous Siva: Somananda's Sivadrsti and His Tantric Interlocutors", authors: ['John Nemec'], isbn: '9780199795451' });
    const b = src({ title: "The Ubiquitous Siva Volume II: Somananda's Sivadrsti and His Philosophical Interlocutors", authors: ['John Nemec'], doi: '10.1093/oso/9780197566725.001.0001' });
    expect(sameWork(a, b)).toBe(false);
    expect(sameWork(b, a)).toBe(false);
  });

  it('keeps two records of the same numbered volume together', () => {
    const a = src({ title: 'Epigraphia Indica, Vol. VI', authors: ['E. Hultzsch'], url: 'https://archive.org/details/epigraphiaindica06' });
    const b = src({ title: 'Epigraphia Indica Vol 6', authors: ['E. Hultzsch'], oclc: '1567718' });
    expect(sameWork(a, b)).toBe(true);
  });
});
