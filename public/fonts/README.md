# Fonts

The site serves its own font files, so neither a build nor a page view contacts Google Fonts.

| Family | Files | Copyright | Licence |
|---|---|---|---|
| Tiro Devanagari Hindi | `v1/tiro-devanagari-hindi-*.woff2` | Copyright 2020 The Indigo Project Authors (https://github.com/TiroTypeworks/Indigo) | SIL Open Font License 1.1, [`licenses/OFL-tiro-devanagari-hindi.txt`](licenses/OFL-tiro-devanagari-hindi.txt) |
| Noto Serif | `v1/noto-serif-normal-*.woff2`, `v1/noto-serif-italic-*.woff2` | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic) | SIL Open Font License 1.1, [`licenses/OFL-noto-serif.txt`](licenses/OFL-noto-serif.txt) |
| Noto Sans | `v1/noto-sans-normal-*.woff2` | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic) | SIL Open Font License 1.1, [`licenses/OFL-noto-sans.txt`](licenses/OFL-noto-sans.txt) |
| Noto Serif Devanagari | `v1/noto-serif-devanagari-*.woff2` | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/devanagari) | SIL Open Font License 1.1, [`licenses/OFL-noto-serif-devanagari.txt`](licenses/OFL-noto-serif-devanagari.txt) |

The licence texts are the `OFL.txt` files of each family in the Google Fonts repository (https://github.com/google/fonts, directory `ofl/`).

## Where the files come from

The woff2 files are the per-subset files that Google Fonts serves for these families, unmodified.
They were taken from the output of a `next/font/google` build of this site, which downloads them from fonts.gstatic.com.
Each file holds one subset of one style; Noto Serif and Noto Sans are variable fonts, so one file covers every weight the site uses.
The `@font-face` rules in `src/styles/fonts.css` carry the same `unicode-range` per subset as Google's CSS, so a browser downloads only the subsets a page needs.
Two subsets with no character anywhere on the site, cyrillic-ext and greek-ext, are not shipped.

## Changing a font

`/fonts/*` is served with an immutable, one-year cache (`next.config.ts`).
Never replace a file in place: add the new files in a new directory (`v2`), point `src/styles/fonts.css` and the preloads in `src/app/layout.tsx` at it, and delete the old directory.
Keep the fallback faces in `src/styles/fonts.css` in step with the new font's metrics, or text will shift when the web font loads.
