---
title: "Ancient Mathematics in India"
summary: "From the rope geometry of Vedic fire altars to the infinite series of medieval Kerala: what the surviving texts show Indian mathematicians did, and where popular claims run ahead of the evidence."
date: "2026-01-10"
updated: "2026-11-21"
tags: [science, mathematics, shulba sutras, aryabhata, brahmagupta, kerala school]
datings:
  - method: scholarly-consensus
    range: { earliest: "800 BCE", latest: "1600", precision: century, circa: true }
    grade: B
    label: "Span of the texts discussed, from the Shulba Sutras to the Kerala school"
    sources: [src.plofker-2009-mathematics-in-india]
    note: "Kim Plofker's survey treats Indian mathematical literature from roughly 500 BCE to 1800 CE; this article covers the part from the Shulba Sutras (about 800 to 200 BCE) to the Kerala school (14th to 16th century CE)."
entities: [text.shulba-sutras, text.baudhayana-shulba-sutra, tradition.agnicayana]
readingLevel: adult
review: { status: draft, author: "claude-sonnet-5-5" }
---

Indian mathematics is real, deep and often brilliant, and it does not need exaggeration.
The surviving evidence is a chain of Sanskrit texts, most of them written in verse for memorisation, that runs from priestly geometry to astronomical trigonometry and infinite series.
This article follows that chain and marks, at each link, what is known and what is only claimed.
The standard modern survey is Kim Plofker's *Mathematics in India* [@src.plofker-2009-mathematics-in-india].

## Geometry for altars: the Shulba Sutras

The earliest surviving Indian mathematics is practical and ritual.
The Shulba Sutras ("rules of the cord") are technical appendices to Vedic ritual manuals, attributed to Baudhayana, Apastamba, Katyayana and Manava.
They tell priests how to lay out brick fire altars with stretched cords and pegs, and they are usually dated to between about 800 and 200 BCE, with Baudhayana's the oldest [@src.plofker-2009-mathematics-in-india].
The altars had to have exact areas and prescribed shapes, such as a falcon, so the texts teach how to turn a square into a rectangle of equal area, how to combine two squares into one, and how to approximate a circle with a square [@src.staal-1983-agni-fire-altar; @src.plofker-2009-mathematics-in-india].

These rules include a clear statement that the diagonal of a rectangle produces the sum of the areas produced by its two sides.
That is the relation we call the Pythagorean theorem, and the texts use it with whole-number triples such as 3, 4, 5 [@src.plofker-2009-mathematics-in-india].
They also give an approximation to the square root of 2 as 1 + 1/3 + 1/(3x4) - 1/(3x4x34), which is 577/408 and correct to about five decimal places [@src.plofker-2009-mathematics-in-india].

Two cautions apply.
First, the same relation was in use in Mesopotamia much earlier, in the Old Babylonian period, so the Shulba Sutras are not the earliest known statement of it [@src.joseph-2011-crest-of-the-peacock].
Second, A. Seidenberg argued that ritual geometry of this kind was the common origin of geometry in India, Babylonia and Greece [@src.seidenberg-1961-ritual-origin-geometry].
That is a minority position, because the cuneiform evidence is the earlier of the two [@src.joseph-2011-crest-of-the-peacock].
What can be said safely is that the Shulba Sutras are the earliest known Indian geometrical texts, and that they presuppose a ritual tradition older than the written texts themselves [@src.plofker-2009-mathematics-in-india].

## Number, algebra and the Siddhanta tradition

From the fifth century CE the main mathematical writing sits inside astronomical treatises, the Siddhantas.
Aryabhata completed his *Aryabhatiya* in 499 CE, by his own reckoning [@src.clark-1930-aryabhatiya; @src.plofker-2009-mathematics-in-india].
It is a very short verse text that gives rules for arithmetic, a table of sines, and an approximation of pi as 62,832/20,000, or 3.1416, which Aryabhata himself calls approximate [@src.clark-1930-aryabhatiya; @src.plofker-2009-mathematics-in-india].
The Indian sine (jya, a "chord" or "bowstring") was a half-chord, which is the ancestor of our word "sine" through Arabic [@src.plofker-2009-mathematics-in-india].
Cosine appears in Indian texts as the sine of the complement, so "introduction of cosine" is better stated as a systematic use of the complementary sine [@src.plofker-2009-mathematics-in-india].

Brahmagupta wrote the *Brahmasphutasiddhanta* in 628 CE.
It contains the earliest surviving text that sets out rules for arithmetic with zero and with negative quantities, treated as "debts" and "fortunes" [@src.plofker-2009-mathematics-in-india].
Some of his rules are correct, and some are not: his treatment of division by zero is unsatisfactory by modern standards [@src.plofker-2009-mathematics-in-india].
He also treated what we now call quadratic indeterminate equations, using a composition method for equations of the form N x squared plus 1 equals y squared [@src.plofker-2009-mathematics-in-india].
Bhaskara II, who wrote the *Lilavati* and *Bijaganita* in the 12th century, continued this algebra and set out the cyclic (chakravala) method for such equations [@src.plofker-2009-mathematics-in-india].

Earlier lost works cannot be ruled out, and the history of zero itself is covered in [Zero and the Decimal System](/science/zero-and-the-decimal-system).

## The Kerala school and the series for pi

The most-discussed claim is that mathematicians in Kerala discovered infinite series for sine, cosine and arctangent "centuries before Newton and Leibniz."
The core of it is well supported.
Madhava of Sangamagrama, active around the late 14th and early 15th century, is credited by later Kerala writers with these series [@src.joseph-2011-crest-of-the-peacock; @src.plofker-2009-mathematics-in-india].
The series appear with proofs in later Malayalam and Sanskrit works, notably Nilakantha's *Tantrasamgraha* (1501) and Jyesthadeva's *Yuktibhasha*, written in the 16th century [@src.plofker-2009-mathematics-in-india; @src.roy-1990-series-formula-pi].
Ranjan Roy's article compares the Kerala derivation of the arctangent series for pi with those of Gregory and Leibniz [@src.roy-1990-series-formula-pi].

Three qualifications are needed.
First, Madhava's own works are not known to survive, so his results are known through later attribution [@src.plofker-2009-mathematics-in-india].
Second, the Kerala results are series expansions found by geometric and arithmetical limiting arguments; they are not a general calculus with a notion of derivative and integral, so "early calculus" overstates them [@src.plofker-2009-mathematics-in-india].
Third, whether this work reached Europe is open.
G. G. Joseph has suggested that transmission via Jesuit contacts in Kerala was possible [@src.joseph-2011-crest-of-the-peacock].
That remains a hypothesis: the surviving record does not document a transmission route, and the European series were derived by their own authors' methods [@src.roy-1990-series-formula-pi].

## Reading the evidence

Almost all of this mathematics survives in Sanskrit verse, often with later commentaries, so dating each text depends on internal evidence, quotations and astronomical data [@src.plofker-2009-mathematics-in-india].
That is why the dates above are "about" and "by his own reckoning".
Where a claim cannot be traced to a text, this article does not make it.
