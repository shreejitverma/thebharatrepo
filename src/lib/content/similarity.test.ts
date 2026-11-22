import { describe, expect, it } from 'vitest';
import { pageMatchesTitle, sameName, sameTitle, titleSimilarity } from './similarity';

describe('sameTitle', () => {
  it('accepts a title without its subtitle', () => {
    expect(sameTitle('Early India', 'Early India: From the Origins to AD 1300')).toBe(true);
    expect(sameTitle('The formation of human populations in South and Central Asia', 'The formation of human populations in South and Central Asia')).toBe(true);
  });
  it('accepts a main title against a record with a long subtitle', () => {
    expect(sameTitle('The Rāgas of Early Indian Music', 'The Ragas of Early Indian Music: Modes, Melodies, and Musical Notations from the Gupta Period to c. 1250')).toBe(true);
    expect(sameTitle('Inscriptions of Asoka: New Edition', 'Inscriptions of Asoka. New Edition by E. Hultzsch')).toBe(true);
  });
  it('accepts records that add a series name or a comma-led edition note', () => {
    expect(sameTitle('The Jains', 'The Jains (Library of Religious Beliefs and Practices)')).toBe(true);
    expect(sameTitle('Astadhyayi of Panini', 'Aṣṭādhyāyī of Pāṇini, In Roman Transliteration by Sumitra Mangesh Katre')).toBe(true);
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
  it('accepts a multi-word label contained in a longer descriptive name, and spelling variants', () => {
    expect(sameName(['Cemetery H Culture (Late Harappan Punjab Phase)'], ['Cemetery H culture'])).toBe(true);
    expect(sameName(['Harappan Civilisation'], ['Indus Valley Civilization', 'Harappan civilization'])).toBe(true);
  });
  it('lets a one-word label identify a named site or person, with a one-letter variant', () => {
    expect(sameName(['Mehrgarh Neolithic and Chalcolithic Site', 'mehrgarh'], ['Mehrgarh'], { namedThing: true })).toBe(true);
    expect(sameName(['Hastinapura Excavations', 'hastinapura'], ['Hastinapur'], { namedThing: true })).toBe(true);
    expect(sameName(['Burzahom Neolithic Site', 'burzahom'], ['Burzahom archaeological site'], { namedThing: true })).toBe(true);
    expect(sameName(['Domestication of Zebu Cattle (Bos indicus)'], ['zebu'], { namedThing: false })).toBe(false);
  });
  it('rejects a related but different thing', () => {
    expect(sameName(['Soma Ritual'], ['Soma'])).toBe(false);
    expect(sameName(['Sarasvati in the Rigveda'], ['Sarasvati River'])).toBe(false);
    expect(sameName(['Domestication of Zebu Cattle (Bos indicus)'], ['zebu'])).toBe(false);
    expect(sameName(['Major Rock Edict XIII of Ashoka'], ['Ashoka'])).toBe(false);
    expect(sameName(['Jwalapuram and the Toba Super-Eruption Debate'], ['Jwalapuram'])).toBe(false);
  });
});
