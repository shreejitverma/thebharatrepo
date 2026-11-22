# Palette

The site's colours are drawn from Hindu iconography and from the pigments and materials of Indian painting and temple craft.
The aim is restraint: a reading surface first, with sacred colour used where it carries meaning (the lenses, the grades, the wheel), never as decoration for its own sake.
Light mode reads as palm-leaf, lime plaster and sandalwood at dawn.
Dark mode reads as temple lamplight on basalt: warm stone, camphor-white ink and a diya-gold hub.

The tokens are CSS custom properties on `:root` in `src/app/globals.css`, redefined for dark mode under `prefers-color-scheme: dark` and under `:root[data-theme='dark']`.
There is no imagery of deities anywhere on the site, and no emoji.
The only ornament is original geometry: the eight-petalled lotus behind the wheel's hub and the wheel itself.

## Iconographic and material basis

Colour names follow the sources below; where a hue is darkened or lifted for contrast, the token keeps the source's hue family.

- **Vishnu and Krishna: nila and shyama, rain-cloud blue.** The dhyana verse "shantakaram bhujagashayanam" calls Vishnu *meghavarna*, the colour of a rain cloud, and Bhagavata Purana 10.3.9 gives the newborn Krishna the beauty of a dense rain cloud (*sandra-payoda-saubhagam*) and yellow silk (*pitambara*).
- **Shiva: karpura-gaura, vibhuti and nila-kantha.** The "karpuragauram" verse names him camphor-white; he is smeared with ash (*bhasma*, *vibhuti*); his throat turns blue from the halahala poison at the churning of the ocean (Bhagavata Purana 8.7); rudraksha beads are his.
- **Brahma: rakta and kanaka.** The creator born of the golden womb, Hiranyagarbha (Rigveda 10.121), seated on the lotus.
- **Shakti, Durga and Kali.** Kumkum and sindoor red, the auspicious red of the Devi; the lion's gold of Durga as *simhavahini*; Kali, whose name means the dark one, emerges from Ambika's brow in the Devi Mahatmya (chapter 7).
- **Lakshmi.** The Sri Sukta calls her *hiranyavarna*, gold-coloured, and *padma*, lotus.
- **Saraswati.** Shveta, white: the verse "ya kundendu tushara hara dhavala" gives her the whiteness of jasmine, the moon and frost; Vasant Panchami, her festival, is kept in pale yellow.
- **Ganesha and Hanuman.** Sindoor orange, the vermilion with which their images are anointed.
- **Dharma and renunciation.** Bhagwa or kesari saffron, and the gerua ochre (*kashaya*) worn by sannyasins.
- **Pigments.** Haldi turmeric; chandan sandalwood; kumkum; the Ajanta mural palette as identified in technical studies of the paintings: red ochre, yellow ochre, terre verte (green earth), lapis lazuli, lamp black and lime white; geru, the red ochre of the Bhimbetka rock paintings; Harappan red-slipped terracotta.
- **Materials.** Panchaloha bronze, copper and temple stone.

## Tokens

### Surfaces, ink and lines

| Token | Light | Dark | Source | Use |
|---|---|---|---|---|
| `--bg` | `#f6efe3` | `#15120f` | Tadpatra palm-leaf; basalt by lamplight | Page background |
| `--bg-elev` | `#fffaf3` | `#1f1a15` | Chuna, Ajanta's lime-white ground | Cards, panels, the wheel's canvas |
| `--bg-sunk` | `#ece1cd` | `#0f0d0a` | Chandan, sandalwood paste | Notices, insets, footer |
| `--ink` | `#1c1a2c` | `#f2e7d3` | Kajal and masi lamp-black ink with Kali's indigo; karpura-gaura in the dark | Body text |
| `--ink-soft` | `#463f55` | `#d4c5ab` | The same ink, thinned | Secondary text |
| `--ink-faint` | `#625a6b` | `#a89a83` | Vibhuti ash, deepened for text | Captions, metadata, year labels |
| `--line` | `#dccdb3` | `#362e25` | Ash on sandalwood | Decorative rules and era boundaries |
| `--line-strong` | `#8f7a5c` | `#7d6a52` | Panchaloha bronze | Borders of inputs, buttons and chips (3:1) |

### Accents

| Token | Light | Dark | Source | Use |
|---|---|---|---|---|
| `--accent` | `#a3202b` | `#f07466` | Kumkum and sindoor: Shakti, Durga | Links, primary buttons, the Today line |
| `--accent-ink` | `#fffaf3` | `#15120f` | Lime white | Text on `--accent` |
| `--gold` | `#7f5200` | `#ebb24c` | Kanaka, Lakshmi's and Brahma's gold (darkened for text in light) | Eyebrows, ornament, the header mark |
| `--indigo` | `#1f3a73` | `#aab9ff` | Nila, Vishnu's rain-cloud blue | Reserved for emphasis in scholarship contexts |
| `--focus` | `#1f55b8` | `#8fb4ff` | Lapis lazuli | Focus rings |

### Lenses

| Token | Light | Dark | Source | Use |
|---|---|---|---|---|
| `--lens-scholarship` | `#22508f` | `#93b4f5` | Lapis lazuli, the measured sky | Scholarship lens tags |
| `--lens-tradition` | `#9a430f` | `#f0a05a` | Gerua, the ochre of renunciants | Tradition lens tags, traditional marks and dashes on the wheel and river, the Kalpa line |

The two lens hues sit on opposite sides of the colour wheel (blue and orange), the pair that stays distinct under every common colour-vision deficiency.
On the wheel and river, tradition is also drawn hollow and dashed, and every tradition date carries the word "tradition".

### Evidence grades

| Token | Light | Dark | Source | Use |
|---|---|---|---|---|
| `--grade-a` | `#1b3f73` | `#a7c0f5` | Nila | Grade A, directly attested (square badge) |
| `--grade-b` | `#2a6390` | `#7fc6d6` | Lapis lazuli | Grade B, strong consensus (square badge) |
| `--grade-c` | `#4a6a37` | `#aecb8c` | Terre verte, Ajanta's green earth | Grade C, reasoned estimate (square badge) |
| `--grade-d` | `#9a430f` | `#f0a05a` | Gerua, the colour of tradition | Grade D, traditional reckoning (round badge) |
| `--grade-e` | `#6a5d61` | `#bcb0a6` | Vibhuti ash | Grade E, speculative (dashed outline badge) |

Grade is never conveyed by colour alone: every badge shows its letter, and the shape encodes the family (square for A to C, round for D, dashed outline for E).
The ramp runs from cool to warm to neutral, and the unit test holds every pair of grades at least 10 CIE76 units apart under normal, protan, deutan and tritan vision.

### Kinds of entry

| Token | Light | Dark | Source | Use |
|---|---|---|---|---|
| `--k-cosmology` | `#8a5c00` | `#ebb24c` | Kanaka: Hiranyagarbha, the golden womb | Cosmology ring and chip |
| `--k-prehistory` | `#8a4426` | `#d9946c` | Geru red ochre of Bhimbetka | Prehistory |
| `--k-civilisation` | `#a8492a` | `#ef8a68` | Harappan red-slipped terracotta | Civilisations |
| `--k-polity` | `#9e1f2c` | `#f07466` | Rakta, the red of royal power and of Durga | Dynasties and states |
| `--k-text` | `#243f7c` | `#a9b8ff` | Nila ink of the manuscript line | Texts |
| `--k-person` | `#1d6762` | `#5cc8bd` | Mayura, Krishna's peacock feather | People |
| `--k-science` | `#2b5c9e` | `#7fb4f5` | Lapis, the jyotisha sky | Science and mathematics |
| `--k-art` | `#9c2d66` | `#ee8fc4` | Padma, Lakshmi's lotus | Arts and architecture |
| `--k-dharma` | `#b4500b` | `#f59a4c` | Bhagwa saffron | Dharma traditions |
| `--k-site` | `#526b25` | `#a9cc6e` | Terre verte and tulsi | Sites |
| `--k-event` | `#5a4740` | `#c9b6ac` | Rudraksha brown | Events |

### Era washes

The wheel's eras, oldest first, each take a pale wash of one source, so the sequence moves from the cosmic ocean through earth pigments to the saffron and lotus of the later eras and the lapis of the present.

| Token | Light | Dark | Source | Use |
|---|---|---|---|---|
| `--era-1` | `#e9ecf3` | `#1c1d26` | Nila: the ocean on which Vishnu sleeps | Cosmic |
| `--era-2` | `#f3e6dc` | `#241b16` | Red ochre | Palaeolithic |
| `--era-3` | `#e8eddc` | `#1c2018` | Terre verte | Neolithic |
| `--era-4` | `#f4e6d6` | `#251c14` | Terracotta | Harappan and Vedic |
| `--era-5` | `#f6ecd2` | `#262014` | Kanaka gold | Classical |
| `--era-6` | `#f7e5d4` | `#271c12` | Kesari saffron | Medieval |
| `--era-7` | `#f5e4e7` | `#26191c` | Padma lotus pink | Early modern |
| `--era-8` | `#e6ebf3` | `#1a1e26` | Lapis | Republic |

The same washes band the river view and the mini strip on entity pages.

### The wheel

| Token | Light | Dark | Source | Use |
|---|---|---|---|---|
| `--wheel-core` | `#1c1a2c` | `#f3e2bf` | The night sky of nila; in the dark, the lamp | Hub disc |
| `--wheel-core-ink` | `#f6efe3` | `#1c1a2c` | Karpura white; lamp-black | Hub text |
| `--wheel-core-ring` | `#d9a441` | `#9a6612` | Pitambara gold | Hub ring and lotus |
| `--wheel-indicator` | `#a3202b` | `#f07466` | A drop of sindoor | The fixed indicator a selection spins to |
| `--wheel-mark-edge` | `#fffaf3` | `#1f1a15` | Lime white | Outline that separates touching marks |
| `--wheel-trad-fill` | `#fffaf3` | `#1f1a15` | Lime white | Fill of hollow traditional marks |
| `--wheel-tag-bg` | `#f0a05a` | `#9a430f` | Gerua | The hub's Tradition tag |
| `--wheel-tag-edge` | `#ffd18f` | `#6d2f0a` | Gerua, lit and shadowed | Tag outline |
| `--wheel-tag-ink` | `#1c1a2c` | `#fffaf3` | Lamp-black; lime white | Tag text |

## Contrast pairs

Every pair below meets WCAG 2.2 AA in both light and dark: 4.5:1 for text, 3:1 for large text and for the graphics and borders that identify a control.
`src/lib/design/palette.test.ts` reads this table and the tokens in `globals.css` and fails if any pair drops below its minimum.
A `*` stands for every matching token.

| Foreground | Background | Minimum | Use |
|---|---|---|---|
| `--ink` | `--bg` | 4.5 | Body text |
| `--ink` | `--bg-elev` | 4.5 | Text on cards and panels |
| `--ink` | `--bg-sunk` | 4.5 | Text on notices |
| `--ink-soft` | `--bg` | 4.5 | Secondary text |
| `--ink-soft` | `--bg-elev` | 4.5 | Secondary text on cards |
| `--ink-soft` | `--bg-sunk` | 4.5 | Secondary text on notices |
| `--ink-faint` | `--bg` | 4.5 | Captions |
| `--ink-faint` | `--bg-elev` | 4.5 | Captions and wheel year labels |
| `--ink-faint` | `--bg-sunk` | 4.5 | Captions on notices |
| `--bg` | `--ink` | 4.5 | Tooltips |
| `--accent` | `--bg` | 4.5 | Links |
| `--accent` | `--bg-elev` | 4.5 | Links on cards, the wheel's Today label |
| `--accent` | `--bg-sunk` | 4.5 | Links in notices |
| `--accent-ink` | `--accent` | 4.5 | Primary buttons |
| `--gold` | `--bg` | 4.5 | Eyebrow text |
| `--gold` | `--bg-elev` | 4.5 | Eyebrow text on cards |
| `--indigo` | `--bg-elev` | 4.5 | Emphasis text |
| `--lens-scholarship` | `--bg` | 4.5 | Scholarship tag |
| `--lens-scholarship` | `--bg-elev` | 4.5 | Scholarship tag on cards |
| `--lens-tradition` | `--bg` | 4.5 | Tradition tag |
| `--lens-tradition` | `--bg-elev` | 4.5 | Tradition tag on cards, the Kalpa label |
| `--bg` | `--grade-a` | 4.5 | Grade letter |
| `--bg` | `--grade-b` | 4.5 | Grade letter |
| `--bg` | `--grade-c` | 4.5 | Grade letter |
| `--bg` | `--grade-d` | 4.5 | Grade letter |
| `--grade-e` | `--bg` | 4.5 | Grade E letter (outlined) |
| `--grade-e` | `--bg-elev` | 4.5 | Grade E letter on cards |
| `--wheel-core-ink` | `--wheel-core` | 4.5 | Hub text |
| `--wheel-tag-ink` | `--wheel-tag-bg` | 4.5 | Hub Tradition tag |
| `--focus` | `--bg` | 3 | Focus ring |
| `--focus` | `--bg-elev` | 3 | Focus ring on cards |
| `--line-strong` | `--bg` | 3 | Control borders |
| `--line-strong` | `--bg-elev` | 3 | Control borders on cards |
| `--k-*` | `--bg-elev` | 3 | Kind chips and marks off the washes |
| `--k-*` | `--era-*` | 3 | Marks on every era wash |
| `--lens-tradition` | `--era-*` | 3 | Traditional marks on every era wash |
| `--accent` | `--era-*` | 3 | The Today line across the washes |
| `--wheel-indicator` | `--bg-elev` | 3 | The indicator |
| `--wheel-core-ring` | `--wheel-core` | 3 | Hub ring |

## Checking

```sh
npx vitest run src/lib/design/palette.test.ts   # fails on any pair below its minimum, naming each pair and its ratio, or a token missing from this page
```
