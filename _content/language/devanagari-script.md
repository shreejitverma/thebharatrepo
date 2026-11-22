---
title: "Devanagari: How the Script of Sanskrit Is Built"
summary: "Devanagari is a syllable-based script whose letters are arranged by where in the mouth each sound is made. This article explains how it works, where it came from, and why Sanskrit was never tied to one script."
date: "2026-11-21"
tags: [language, sanskrit, devanagari, writing systems, brahmi]
datings:
  - method: epigraphic
    range: { earliest: "260 BCE", latest: "232 BCE", precision: decade, circa: true }
    grade: A
    label: "Brahmi, the ancestor script, in the edicts of Ashoka"
    sources: [src.salomon-1998-indian-epigraphy, src.thapar-2002-early-india]
    note: "The earliest securely dated Brahmi texts are Ashoka's edicts of the mid-3rd century BCE. The script is therefore at least that old; its origin before that is debated."
  - method: art-historical
    range: { earliest: "700 CE", latest: "1100 CE", precision: century, circa: true }
    grade: C
    label: "Emergence of the mature Nagari and Devanagari forms"
    sources: [src.salomon-1998-indian-epigraphy]
    note: "Nagari grew out of the northern Brahmi-derived scripts over several centuries. Where one draws the line between late Gupta-derived forms and 'Devanagari' is a matter of convention."
entities: [text.ashtadhyayi, person.panini, concept.indus-script]
readingLevel: adult
review: { status: draft, author: "codex-gpt-6" }
---

Devanagari (देवनागरी, *devanāgarī*) is the script in which most people today read Sanskrit, Hindi, Marathi and Nepali.
Its letters follow patterns that make the script easier to learn: consonants carry an inherent vowel, vowel signs modify it, and consonant clusters combine in regular ways.
Spelling does not capture every detail of pronunciation, and modern languages written in Devanagari use some letters differently [@src.daniels-bright-1996-worlds-writing-systems].

## A script that counts syllables

Most alphabets, like the Latin one, give every consonant and every vowel its own letter.
Devanagari works differently.
Each consonant letter stands for a consonant plus the short vowel *a*, so क is *ka*, not *k*.
Linguists call a script of this kind an abugida, and Devanagari is one of its best-known examples [@src.daniels-bright-1996-worlds-writing-systems].

To change the vowel, you add a sign called a *mātrā* to the consonant.
To remove the vowel altogether, you add a small slanting mark below, the *virāma* (्).

| Vowel | Sign on क | Reads as |
| :--- | :--- | :--- |
| a (inherent) | क | ka |
| ā | का | kā |
| i | कि | ki |
| ī | की | kī |
| u | कु | ku |
| ū | कू | kū |
| ṛ | कृ | kṛ |
| e | के | ke |
| ai | कै | kai |
| o | को | ko |
| au | कौ | kau |

One quirk surprises beginners: the sign for short *i* (ि) is written to the left of its consonant but is pronounced after it.
So कि is read *ki*, even though the little hook comes first on the page.
When a word starts with a vowel, the vowel gets its own full letter: अ, आ, इ, ई, उ, ऊ, ऋ, ए, ऐ, ओ, औ, plus the rare syllabic *l* (ऌ).

## A chart organised by the mouth

The consonants are not listed in the arbitrary order of the Latin alphabet.
They are arranged in a grid by where the tongue touches, from the back of the mouth to the lips, and by how the sound is made.

| Place | Voiceless | Voiceless aspirated | Voiced | Voiced aspirated | Nasal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Velar (throat) | क ka | ख kha | ग ga | घ gha | ङ ṅa |
| Palatal | च ca | छ cha | ज ja | झ jha | ञ ña |
| Retroflex | ट ṭa | ठ ṭha | ड ḍa | ढ ḍha | ण ṇa |
| Dental | त ta | थ tha | द da | ध dha | न na |
| Labial (lips) | प pa | फ pha | ब ba | भ bha | म ma |

After these twenty-five come the semivowels य ya, र ra, ल la, व va, the sibilants श śa, ष ṣa, स sa, and the breathy ह ha.
"Aspirated" means released with an extra puff of breath, so *kha* is a *k* followed by a burst of air.
Traditional Sanskrit phonetics assigns *ra* to the retroflex position and *la* to the dental one [@src.katre-1987-astadhyayi-panini].

This sound-based ordering reflects the Indian grammatical tradition's careful analysis of articulation.
The traditional arrangement moves from the back of the mouth toward the lips, while separating sounds by voicing, aspiration and nasality [@src.katre-1987-astadhyayi-panini; @src.salomon-1998-indian-epigraphy].
Pāṇini's grammar, the *Aṣṭādhyāyī* (roughly the 5th to 4th century BCE), uses a different, compact ordering of sounds of its own, built for writing rules efficiently rather than for teaching the alphabet [@src.cardona-1988-panini-work-traditions; @src.katre-1987-astadhyayi-panini].

## Signs that tune the sound

Four small marks complete the system, with functions that vary somewhat across languages and contexts [@src.daniels-bright-1996-worlds-writing-systems].

- *Anusvāra* (ं) marks a nasal sound at the end of a syllable, as in संस्कृतम् (*saṃskṛtam*).
- *Candrabindu* (ँ) marks a nasalised vowel, common in Hindi.
- *Visarga* (ः) marks a light breathy *h* after a vowel, as in नमः (*namaḥ*).
- *Virāma* (्) cancels the inherent *a*, leaving a bare consonant.

## Conjuncts: consonants that join

When two or more consonants occur with no vowel between them, Devanagari usually fuses them into one shape called a conjunct [@src.daniels-bright-1996-worlds-writing-systems].
The first consonant is written in a reduced form and attached to the next, or the two are stacked.

| Conjunct | Made of | Example word |
| :--- | :--- | :--- |
| क्ष | क + ष | मोक्ष (*mokṣa*, liberation) |
| त्र | त + र | मन्त्र (*mantra*) |
| ज्ञ | ज + ञ | ज्ञान (*jñāna*, knowledge) |
| श्र | श + र | श्री (*śrī*, auspicious) |
| द्ध | द + ध | बुद्ध (*buddha*, awakened) |
| स्त | स + त | नमस्ते (*namaste*) |
| द्य | द + य | विद्या (*vidyā*, learning) |

Most conjuncts can be read off their parts, but a few, notably क्ष and ज्ञ, have shapes that no longer look like their ingredients.
Pronunciation of ज्ञ also varies by region: it is read roughly as *gya* in much of North India and as *dnya* in Marathi, while its Sanskrit value is *j* followed by *ñ*.

## Where the script came from

Devanagari descends through the Nagari script family from Brahmi, the script used in Ashoka's edicts.
Those edicts of the 3rd century BCE provide the earliest securely dated extensive evidence for Brahmi, although the script may have existed earlier [@src.salomon-1998-indian-epigraphy; @src.thapar-2002-early-india].
Over the following centuries Brahmi developed into regionally distinct forms.
In northern India, Gupta-period and later scripts contributed to Nagari; the names and boundaries used for stages such as “early Nagari” and “Devanagari” vary among scholars [@src.salomon-1998-indian-epigraphy].

### Where did Brahmi itself come from?

The origin of Brahmi remains debated, and the surviving evidence does not settle it.

- **A model from West Asian scripts.** Richard Salomon considers a Semitic model, especially Aramaic, plausible while noting how extensively Brahmi's forms and organization differ [@src.salomon-1998-indian-epigraphy].
- **A Mauryan-period creation.** Harry Falk argues that Brahmi was devised not long before Ashoka's inscriptions, drawing on Aramaic and possibly Greek models [@src.falk-1993-schrift-im-alten-indien].
- **Indigenous development.** Proposals that Brahmi developed locally, including from the Indus script, have also been made.
  The Indus script remains undeciphered, and a documented sequence showing its transformation into Brahmi has not been established [@src.parpola-1994-deciphering-indus-script; @src.salomon-1998-indian-epigraphy].

The three positions disagree about the source, not about the result: by the 3rd century BCE a well-designed script for the Indo-Aryan languages existed.

## Sanskrit had no script of its own

It is easy to assume that Sanskrit and Devanagari belong together, but Sanskrit has been written in many scripts.
Vedic texts were preserved through memorisation and recitation, practices that continue in living traditions and that UNESCO has documented [@src.unesco-2003-tradition-vedic-chanting].
When Sanskrit was written down, it was written in whatever script the region used: Śāradā in Kashmir, Grantha and Malayalam scripts in the south, Bengali, Kannada, Telugu, Sinhala, and the scripts of Southeast Asia [@src.salomon-1998-indian-epigraphy; @src.pollock-2006-language-of-the-gods].
Devanagari became the usual script for printed Sanskrit largely in the modern period, which is why it feels inseparable today.

## Reading practice

Try the words below, using the rules above.

| Devanagari | Reading | Meaning |
| :--- | :--- | :--- |
| ॐ | *oṃ* | the sacred syllable |
| नमस्ते | *namaste* | I bow to you |
| संस्कृतम् | *saṃskṛtam* | Sanskrit, "put together, refined" |
| अहिंसा | *ahiṃsā* | non-violence |
| भगवद्गीता | *bhagavadgītā* | the Song of the Lord |

The name *saṃskṛta* means "put together" or "perfected", and it was applied to the language as a way of marking it off from everyday speech [@src.pollock-2006-language-of-the-gods].
The name *devanāgarī* is often glossed as “script of the divine city,” but its historical formation is uncertain; the familiar gloss should not be treated as a settled etymology [@src.salomon-1998-indian-epigraphy].
