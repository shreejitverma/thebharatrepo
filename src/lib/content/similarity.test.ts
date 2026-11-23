import { describe, expect, it } from 'vitest';
import { cachedTitleMatches, urlMatchKind, pageMatchesTitle, sameName, sameTitle, titleSimilarity, volumesMatch } from './similarity';
import { sameWork } from './load';
import { SourceSchema } from './schema';

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
  it('rejects a narrower main title even when its subtitle adds shared words', () => {
    expect(sameTitle('The Art of Ancient India: Buddhist, Hindu, Jain', 'Classical Art and Ancient India')).toBe(false);
    expect(sameTitle('Classical Art and Ancient India', 'The Art of Ancient India: Buddhist, Hindu, Jain')).toBe(false);
  });
  it('accepts a record whose subtitle only names a retail packaging or an edition', () => {
    expect(sameTitle('The Rigveda: The Earliest Religious Poetry of India', 'The Rigveda: 3-Volume Set')).toBe(true);
    expect(sameTitle('The Mahabharata: A Modern Rendering', 'The Mahabharata: Box Set')).toBe(true);
    expect(sameTitle('Hampi: A Story in Stone', 'Hampi (Paperback)')).toBe(true);
    expect(sameTitle('A Sanskrit Grammar for Students', 'A Sanskrit Grammar for Students: Third Revised Edition')).toBe(true);
    expect(sameTitle('The Upanishads: A New Translation', 'The Upanishads, Vols. 1-3')).toBe(true);
    expect(sameTitle('The Bhagavad Gita, 2nd edition', 'The Bhagavad Gita: A New Translation')).toBe(true);
  });
  it('still tells apart real subtitles, other works and single volumes next to a packaging subtitle', () => {
    expect(sameTitle('The Rigveda: The Earliest Religious Poetry of India', 'The Rigveda: A Guide')).toBe(false);
    expect(sameTitle('The Rigveda: The Earliest Religious Poetry of India', 'The Atharvaveda: 2-Volume Set')).toBe(false);
    expect(sameTitle('The Rigveda, Volume 1', 'The Rigveda: 3-Volume Set')).toBe(false);
    expect(sameTitle('India: The First Millennium', 'India: A History')).toBe(false);
  });
  it('matches a single-volume record only to a title that names the same volume', () => {
    expect(sameTitle('The Rigveda: The Earliest Religious Poetry of India', 'The Rigveda, Volume 1')).toBe(false);
    expect(sameTitle('The Rigveda', 'The Rigveda, Volume 1')).toBe(false);
    expect(sameTitle('The Mahabharata: A Modern Rendering', 'The Mahabharata (Volume 2)')).toBe(false);
    expect(sameTitle('The Ramayana: A New Translation', 'The Ramayana, Book II')).toBe(false);
    expect(sameTitle('The Rigveda, Volume 1', 'The Rigveda, Vol. 1')).toBe(true);
    expect(sameTitle('The Ramayana, Part 2', 'The Ramayana: Part II')).toBe(true);
    expect(sameTitle('The Rigveda, Volume 1', 'The Rigveda, Volume 2')).toBe(false);
  });
  it('never matches an unnumbered cited work to a single-volume record, under any rule', () => {
    // The two-word main-title rule used to pass these.
    expect(sameTitle('A History of Indian Philosophy', 'A History of Indian Philosophy, Volume 1')).toBe(false);
    expect(sameTitle("Kalhana's Rajatarangini: A Chronicle of the Kings of Kasmir", 'Kalhana’s Rājataraṅginī: A Chronicle of the Kings of Kaśmīr, Vol. I')).toBe(false);
    // The overlap test used to pass this, and the izafat "-i-" reads as the numeral I, so numbers alone cannot tell.
    expect(sameTitle('The Ain-i Akbari', 'Ain-i-akbari  Vol. 1')).toBe(false);
    expect(sameTitle('Mohenjo-daro and the Indus Civilization', 'Mohenjo Daro and the Indus Civilization  Vol-i (1931)')).toBe(false);
    expect(sameTitle('The Veda of the Black Yajus School', 'The Veda of the Black Yajus School Taittiriya Sanhita Part 1: Kandas I-III')).toBe(false);
  });
  it('matches a cited volume to a record that names the same volume, written either way', () => {
    expect(sameTitle('The Ain-i Akbari, Volume 1', 'Ain-i-akbari  Vol. 1')).toBe(true);
    expect(sameTitle("Kalhana's Rajatarangini: A Chronicle of the Kings of Kasmir, Volume 1", 'Kalhana’s Rājataraṅginī: A Chronicle of the Kings of Kaśmīr, Vol. I')).toBe(true);
    expect(sameTitle('Inscriptions of the Early Gupta Kings and Their Successors (Corpus Inscriptionum Indicarum, Vol. III)', 'Corpus Inscriptionum Indicarum  Vol. 3')).toBe(true);
  });
  it('lets a registry drop the volume number the citation gives, since the identifier pins the volume', () => {
    expect(sameTitle('A History of the Sikhs, Volume 1: 1469-1838', 'A history of the Sikhs')).toBe(true);
  });
  it('reads a series number in a record as the series, and books as divisions inside a volume', () => {
    expect(sameTitle('The Indo-Aryans of Ancient South Asia: Language, Material Culture and Ethnicity', 'The Indo-Aryans of Ancient South Asia: Language, Material Culture and Ethnicity (Indian Philology and South Asian Studies, Vol 1)')).toBe(true);
    expect(sameTitle('The Satapatha-Brahmana, According to the Text of the Madhyandina School, Part V (Sacred Books of the East, Vol. 44)', 'SBE 44: The Satapatha-Brahmana, Part 5, Books XI-XIV (Sacred Books of the East)')).toBe(true);
  });
  it('does not count the word volume as shared subject matter', () => {
    expect(
      sameTitle('An English Translation of the Sushruta Samhita, Based on Original Sanskrit Text, Vol. I: Sutrasthanam', 'Sangitaratnakara of Sarngadeva: Sanskrit Text and English Translation with Comments and Notes, Volume 1'),
    ).toBe(false);
  });
  it('treats two archive records as the same volume only when both are unnumbered or both name it', () => {
    expect(volumesMatch('A History of the Sikhs', 'A History of the Sikhs, Volume 1')).toBe(false);
    expect(volumesMatch('A History of the Sikhs, Vol. 1', 'A History of the Sikhs, Volume I')).toBe(true);
    expect(volumesMatch('A History of the Sikhs', 'A History of the Sikhs: 3-Volume Set')).toBe(true);
    const record = (id: string, title: string) => SourceSchema.parse({ id, type: 'book', title, authors: ['A Author'], isbn: '9780195673081' });
    expect(sameWork(record('src.a', 'A History of the Sikhs, Volume 1'), record('src.b', 'A History of the Sikhs'))).toBe(false);
    expect(sameWork(record('src.a', 'A History of the Sikhs'), record('src.b', 'A History of the Sikhs, Volume 1'))).toBe(false);
    expect(sameWork(record('src.a', 'A History of the Sikhs, Volume 1'), record('src.b', 'A History of the Sikhs, Vol. I'))).toBe(true);
  });
  it('rejects a different volume of the same work', () => {
    expect(sameTitle('History of Indian Medical Literature, Vol. 1', 'History of Indian Medical Literature, Vol. 2')).toBe(false);
    expect(sameTitle('Epigraphia Indica Vol 1', 'Epigraphia Indica Vol 6')).toBe(false);
    expect(sameTitle('A History of Early Vedanta Philosophy, Volume 2', 'A History of Early Vedanta Philosophy, Part I')).toBe(false);
  });
  it('reads Roman and Arabic volume numbers as the same number', () => {
    expect(sameTitle('Epigraphia Indica, Vol. VI', 'Epigraphia Indica Vol 6')).toBe(true);
    expect(sameTitle('A History of Early Vedanta Philosophy, Part 1', 'A History of Early Vedanta Philosophy, Part I')).toBe(true);
  });
  it('rejects a sibling work whose title differs only in its subject', () => {
    expect(sameTitle('Ajanta Caves - UNESCO World Heritage Centre', 'Ellora Caves - UNESCO World Heritage Centre')).toBe(false);
    expect(sameTitle('Early History of India', 'Early History of Bengal')).toBe(false);
  });
  it('keeps subject words such as cultural and world significant inside a title', () => {
    expect(sameTitle('A Cultural History of India', 'A Political History of India')).toBe(false);
    expect(sameTitle('Cultural History of Ancient India', 'Economic History of Ancient India')).toBe(false);
    expect(sameTitle('World Religions of India', 'Folk Religions of India')).toBe(false);
    expect(pageMatchesTitle('A Cultural History of India', 'A Political History of India')).toBe(false);
  });
  it('treats a year in a main title as part of the subject', () => {
    expect(sameTitle('The Nobel Prize in Physics 1930', 'The Nobel Prize in Physics 1931')).toBe(false);
    expect(pageMatchesTitle('The Nobel Prize in Physics 1930', 'The Nobel Prize in Physics 1931')).toBe(false);
    expect(sameTitle('Indian Independence Act 1947', 'Indian Independence Act 1935')).toBe(false);
    expect(sameTitle('Bengal 1757: The Battle', 'Bengal 1857: The Battle')).toBe(false);
    expect(sameTitle('The Nobel Prize in Physics 1930', 'The Nobel Prize in Physics 1930')).toBe(true);
  });
  it('rejects different works that share a main title but not a subtitle', () => {
    expect(sameTitle('Early India: From the Origins to AD 1300', 'Early India: A Concise History')).toBe(false);
    expect(sameTitle('Ancient India: Political History', 'Ancient India: Social and Cultural Life')).toBe(false);
    expect(sameTitle('Sun Temple, Konarak', 'Sun Temple, Modhera')).toBe(false);
    expect(pageMatchesTitle('Sun Temple, Konarak', 'Sun Temple, Modhera')).toBe(false);
  });
  it('accepts a record that drops the subtitle or misspells a word by one swapped pair of letters', () => {
    expect(sameTitle('Early India: From the Origins to AD 1300', 'Early India')).toBe(true);
    expect(sameTitle('Classical Hindu Mythology: A Reader in the Sanskrit Puranas', 'Classical Hindu Mythology: A Reader in the Sanskirt Puranas')).toBe(true);
    expect(sameTitle("Gandhi's Rise to Power: Indian Politics 1915-1922", "Gandhi's Rise to Power: Indian Politics 1915-1922 (Cambridge South Asian Studies)")).toBe(true);
  });
  it('rejects a short title whose words are scattered through a different work', () => {
    expect(sameTitle('A History of India', 'History of the Archaeological Survey of India')).toBe(false);
    expect(sameTitle('The Mughal Empire', 'The Princes of the Mughal Empire, 1504-1719')).toBe(false);
    expect(sameTitle('A History of India', 'A History of India, Fourth Edition')).toBe(true);
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
  it('rejects a page about a sibling subject with a near-identical title', () => {
    expect(pageMatchesTitle('Group of Monuments at Mahabalipuram', 'Group of Monuments at Hampi - UNESCO World Heritage Centre')).toBe(false);
    expect(pageMatchesTitle('Ajanta Caves', 'Ellora Caves - UNESCO World Heritage Centre')).toBe(false);
    expect(pageMatchesTitle('Ajanta Caves', 'Ajanta Caves - UNESCO World Heritage Centre')).toBe(true);
  });
  it('does not count shared site boilerplate as evidence of the same page', () => {
    expect(pageMatchesTitle('Ajanta Caves - UNESCO World Heritage Centre', 'Taj Mahal - UNESCO World Heritage Centre')).toBe(false);
    expect(pageMatchesTitle('Sanchi - UNESCO World Heritage Centre', 'Ellora Caves - UNESCO World Heritage Centre')).toBe(false);
    expect(pageMatchesTitle('Khajuraho Group of Monuments - UNESCO World Heritage Centre', 'Taj Mahal - UNESCO World Heritage Centre')).toBe(false);
    expect(sameTitle('Ajanta Caves - UNESCO World Heritage Centre', 'Taj Mahal - UNESCO World Heritage Centre')).toBe(false);
  });
  it('reads HTML entities and bracketed cataloguer notes in page titles as punctuation', () => {
    expect(pageMatchesTitle('Rabindranath Tagore - Facts', 'Rabindranath Tagore &#8211; Facts - NobelPrize.org')).toBe(true);
    expect(pageMatchesTitle('The Invasion of India by Alexander the Great', 'The invasion of India by Alexander the Great [microform], as described by Arrian')).toBe(true);
  });
  it('rejects a page that does not carry the title', () => {
    expect(pageMatchesTitle('Tradition of Vedic chanting', 'Page not found')).toBe(false);
  });
});

describe('cached title rechecks', () => {
  it('judges catalogue URLs as registry records and other URLs as web pages', () => {
    expect(urlMatchKind('https://archive.org/details/invasionofindiab00mccr')).toBe('record');
    expect(urlMatchKind('https://openlibrary.org/works/OL123W')).toBe('record');
    expect(urlMatchKind('https://whc.unesco.org/en/list/242/')).toBe('page');
    expect(urlMatchKind('not a url')).toBe('page');
  });
  it('rejects a shorter cited title for a catalogue item about a different work', () => {
    const url = 'https://archive.org/details/princesofmughalem0000faru';
    expect(cachedTitleMatches(urlMatchKind(url), 'The Mughal Empire', 'The Princes of the Mughal Empire, 1504-1719')).toBe(false);
    expect(cachedTitleMatches(urlMatchKind(url), 'The Princes of the Mughal Empire', 'The Princes of the Mughal Empire, 1504-1719')).toBe(true);
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
  it('tells apart rulers and scholars that differ only by a regnal number', () => {
    expect(sameName(['Chandragupta II'], ['Chandragupta I'], { namedThing: true })).toBe(false);
    expect(sameName(['Bhaskara II'], ['Bhaskara I'], { namedThing: true })).toBe(false);
    expect(sameName(['Chandragupta II'], ['Chandragupta'], { namedThing: true })).toBe(false);
    expect(sameName(['Bhaskara II', 'Bhāskara II'], ['Bhāskara II'], { namedThing: true })).toBe(true);
    expect(sameName(['Rajaraja I'], ['Rajaraja 1'], { namedThing: true })).toBe(true);
  });
  it('rejects a related but different thing', () => {
    expect(sameName(['Soma Ritual'], ['Soma'])).toBe(false);
    expect(sameName(['Sarasvati in the Rigveda'], ['Sarasvati River'])).toBe(false);
    expect(sameName(['Domestication of Zebu Cattle (Bos indicus)'], ['zebu'])).toBe(false);
    expect(sameName(['Major Rock Edict XIII of Ashoka'], ['Ashoka'])).toBe(false);
    expect(sameName(['Jwalapuram and the Toba Super-Eruption Debate'], ['Jwalapuram'])).toBe(false);
  });
});
