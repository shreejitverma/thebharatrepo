import { describe, expect, it } from 'vitest';
import { pageMatchesTitle, sameName, sameTitle, titleSimilarity } from './similarity';

describe('sameTitle', () => {
  it('accepts a title without its subtitle', () => {
    expect(sameTitle('Early India', 'Early India: From the Origins to AD 1300')).toBe(true);
    expect(sameTitle('The formation of human populations in South and Central Asia', 'The formation of human populations in South and Central Asia')).toBe(true);
  });
  it('ignores case, diacritics and punctuation', () => {
    expect(sameTitle('Āryabhaṭīya of Āryabhaṭa', 'aryabhatiya of aryabhata')).toBe(true);
  });
  it('rejects a one-word subset of a longer title', () => {
    expect(sameTitle('Early India: From the Origins to AD 1300', 'India')).toBe(false);
    expect(sameTitle('The Rigveda', 'Rigveda and Avesta: a comparative grammar of sacrifice')).toBe(false);
  });
  it('rejects an unrelated work that reuses an identifier', () => {
    expect(sameTitle('Vedic Astronomy Proves the Mahabharata War Occurred in 5561 BCE', 'The formation of human populations in South and Central Asia')).toBe(false);
    expect(titleSimilarity('', 'anything')).toBe(0);
  });
});

describe('pageMatchesTitle', () => {
  it('accepts a page title with a site suffix', () => {
    expect(pageMatchesTitle('Tradition of Vedic chanting', 'UNESCO - Tradition of Vedic chanting - intangible heritage')).toBe(true);
  });
  it('rejects a page that does not carry the title', () => {
    expect(pageMatchesTitle('Tradition of Vedic chanting', 'Page not found')).toBe(false);
  });
});

describe('sameName', () => {
  it('accepts exact labels and close aliases', () => {
    expect(sameName(['Rigveda', 'Ṛgveda'], ['Rigveda'])).toBe(true);
    expect(sameName(['Mohenjo-daro'], ['Mohenjo-daro'])).toBe(true);
  });
  it('rejects a related but different thing', () => {
    expect(sameName(['Domestication of Zebu Cattle (Bos indicus)'], ['zebu'])).toBe(false);
    expect(sameName(['Major Rock Edict XIII of Ashoka'], ['Ashoka'])).toBe(false);
    expect(sameName(['Jwalapuram and the Toba Super-Eruption Debate'], ['Jwalapuram'])).toBe(false);
  });
});
