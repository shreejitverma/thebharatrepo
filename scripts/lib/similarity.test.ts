import { describe, expect, it } from 'vitest';
import { titleSimilarity } from './similarity';

describe('titleSimilarity', () => {
  it('matches a title without its subtitle', () => {
    expect(titleSimilarity('Early India', 'Early India: From the Origins to AD 1300')).toBe(1);
  });
  it('ignores case, diacritics and punctuation', () => {
    expect(titleSimilarity('Āryabhaṭīya of Āryabhaṭa', 'aryabhatiya of aryabhata')).toBe(1);
  });
  it('rejects an unrelated work', () => {
    expect(titleSimilarity('The formation of human populations in South and Central Asia', 'Quantum dots in graphene')).toBe(0);
  });
  it('returns 0 for empty input', () => {
    expect(titleSimilarity('', 'anything')).toBe(0);
  });
});
