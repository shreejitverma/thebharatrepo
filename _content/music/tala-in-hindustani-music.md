---
title: "Tala in Hindustani Music: Cycles, Thekas and the Tihai"
summary: "How North Indian classical music organises time as a returning cycle: the avartan, vibhag, tali and khali, the theka of Teentaal, Jhaptal and Rupak, layakari, and the arithmetic of the tihai."
date: "2026-11-21"
tags: [music, tala, hindustani, tabla, rhythm, layakari, tihai]
datings:
  - method: scholarly-consensus
    range: { earliest: "1500 CE", latest: "1900 CE", precision: century, circa: true }
    grade: C
    label: "Approximate placement of the living theka-based system"
    sources: [src.clayton-2000-time-in-indian-music]
    note: "A loose placement only. The theory behind the system (tala as a cycle of beats) is far older, and the individual thekas have their own undated histories."
entities: []
readingLevel: adult
review: { status: draft, author: "claude-sonnet-5-5" }
---

Western music usually thinks of time as a straight road marked off in bars.
North Indian music thinks of it as a wheel.
A cycle of beats is played, it arrives home, and it begins again, and everything a performer does is shaped by where they are on that wheel and how far they are from home [@src.clayton-2000-time-in-indian-music].
The cycle is called a tala (tāla), and the home beat is called the sam (सम).

## The anatomy of a cycle

One full pass through a tala is an avartan (āvartana, "turning").
The avartan is made of a fixed number of equal beats, each a matra (mātrā).
The beats are grouped into sections called vibhag (vibhāga), and the grouping is not decoration.
It is what makes a 10-beat tala feel different from a 12-beat one, even though a listener may never count aloud [@src.clayton-2000-time-in-indian-music].

Four landmarks guide both players and listeners:

| Term | Meaning |
|---|---|
| Sam | The first beat of the cycle, the point of arrival where phrases resolve. Marked X. |
| Tali | A clapped beat that opens a vibhag, marked with the numbers 2, 3, 4 and so on. |
| Khali | "Empty": a beat shown by a wave of the hand instead of a clap, marked 0. |
| Theka | The characteristic pattern of drum syllables (bols) that spells out the tala on tabla or pakhawaj. |

The khali is a balancing device.
In many talas the theka also changes its syllables there, so a resonant stroke such as "dha" gives way to a drier one such as "ta", and the ear hears a hollow in the middle of the cycle even when the pulse never stops [@src.clayton-2000-time-in-indian-music].

## Three thekas worth knowing

**Teentaal** has 16 matras in four vibhags of 4+4+4+4.
Claps fall on beats 1 (sam), 5 and 13, and the wave on beat 9.
The standard theka is:

| Vibhag | 1 (X) | 2 (2) | 3 (0) | 4 (3) |
|---|---|---|---|---|
| Matras | 1 2 3 4 | 5 6 7 8 | 9 10 11 12 | 13 14 15 16 |
| Bols | Dha Dhin Dhin Dha | Dha Dhin Dhin Dha | Dha Tin Tin Ta | Ta Dhin Dhin Dha |

Note the khali: the "dhin" syllables of the other three sections become "tin" in the third, which is the audible sign of the wave [@src.clayton-2000-time-in-indian-music].

**Jhaptal** has 10 matras in an uneven 2+3+2+3.
Claps fall on beats 1, 3 and 8, and the wave on beat 6.
Its theka is Dhi Na | Dhi Dhi Na | Ti Na | Dhi Dhi Na.
The uneven sections give it a lilting, limping gait, and it is common in medium-tempo khayal and in instrumental music [@src.clayton-2000-time-in-indian-music].

**Rupak** has 7 matras in 3+2+2, with the theka Tin Tin Na | Dhi Na | Dhi Na.
It is often described as unusual because its first beat is marked with the wave, not a clap, so the sam and the khali coincide.
The claps fall on beats 4 and 6 [@src.clayton-2000-time-in-indian-music].

Other common talas include Ektal (12 beats in six groups of two), Chautal (12), Dhamar (14, grouped 5+2+3+4), Keherwa (8) and Dadra (6).
The lighter 6- and 8-beat talas are associated with light classical and folk-derived genres, and the heavier even-grouped talas with dhrupad and the pakhawaj, though the association is a tendency and not a rule [@src.clayton-2000-time-in-indian-music].
Bol patterns for the heavier talas vary between gharanas, so they are not tabulated here.

## Speed and layakari

Laya (laya) is tempo, and Hindustani practice names three broad bands: vilambit (slow), madhya (medium) and drut (fast) [@src.clayton-2000-time-in-indian-music].
Layakari (layakārī) is the art of playing with the relationship between the underlying pulse and the density of the notes.
The simple versions are:

- barabar or thah: one syllable to each beat,
- dugun: two to each beat,
- tigun: three to each beat,
- chaugun: four to each beat.

More exotic ratios, such as five notes spread across four beats, are also part of the art.
Their names (such as kuari and biari) are used inconsistently between teachers and in the printed literature, so this article does not fix a ratio to each name [@src.clayton-2000-time-in-indian-music].

## The tihai

A tihai (tihāī, "a three") is a phrase played three times so that the whole statement ends exactly on the sam, announcing the return home.
The player must therefore treat the cycle as arithmetic [@src.clayton-2000-time-in-indian-music].

Let T be the number of matras in the cycle, p the length of the phrase in matras, and g the length of the gap between repetitions (zero or more).
If the tihai begins on beat b and its final stroke is to fall on the sam of the next cycle, it must fill the beats from b to the sam inclusive, which is T - b + 2 matras:

3p + 2g = T - b + 2

A tihai with no gap (g = 0) is called bedam ("breathless"), and one with equal rests is damdar.
A chakradar tihai is one whose whole three-part structure is itself played three times.

Two worked examples in Teentaal (T = 16):

- Begin on beat 3, no gap. The span is 16 - 3 + 2 = 15 matras, so p = 5. Beats 3 to 7, 8 to 12 and 13 to 17 hold the three phrases, and beat 17 is the next sam.
- Begin on beat 4, with a one-beat rest between phrases. The span is 14 matras, so 3p + 2 = 14 gives p = 4. The phrases take beats 4 to 7, 9 to 12 and 14 to 17, with rests on beats 8 and 13.

If the span does not divide evenly, the player adjusts the starting beat, the gap or the phrase, which is why a good tihai is both a calculation and a flourish.
Conventions differ slightly: some players count the tihai as ending just before the sam and not on it, and the formula changes by one matra accordingly [@src.clayton-2000-time-in-indian-music].

## Why the cycle matters

For the listener, the practical lesson is that a rhythmic cycle is a promise.
The sam is promised from the first beat, and the pleasure of the music is largely in how long the performers can delay it, disguise it and then deliver it.
A soloist and the tabla player may begin phrases on off-beats, play across the vibhag boundaries and in unexpected ratios, and then converge on the sam together [@src.clayton-2000-time-in-indian-music].

The same vocabulary of tala, laya and the ten "vital elements" of tala belongs to a much older theoretical tradition, summarised in the companion article on marga talas and the ten pranas, and the South Indian counterpart is described in the companion article on the Carnatic tala system [@src.rao-2013-evolution-tala-dasa-prana].
