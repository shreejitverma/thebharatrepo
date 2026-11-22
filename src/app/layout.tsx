import type { Metadata, Viewport } from 'next';
import { preload } from 'react-dom';
import '../styles/fonts.css';
import './globals.css';
import '../styles/learning.css';
import '../styles/print.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import DraftNotice from '../components/DraftNotice';
import { SITE_URL } from '@/lib/content/site';
import { READING_LEVEL_BOOT_SCRIPT } from '@/lib/reading-level';

/**
 * Fonts are self-hosted (src/styles/fonts.css, public/fonts): the build never contacts Google Fonts.
 * Only the latin subsets of the three faces used above the fold are preloaded; every other subset (latin-ext for
 * IAST, Devanagari, italics) loads on demand through its unicode-range, which keeps about 670 KB off every page.
 */
const PRELOADED_FONTS = ['tiro-devanagari-hindi-normal-latin', 'noto-serif-normal-latin', 'noto-sans-normal-latin'];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'The Bharat Repo: the evidence-based archive of Bharat', template: '%s | The Bharat Repo' },
  description:
    'The history, knowledge and living traditions of Bharat and Sanatana Dharma, every entry placed in time on the Kaalchakra and backed by graded, verifiable evidence.',
  openGraph: { siteName: 'The Bharat Repo', type: 'website', locale: 'en_IN' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6efe3' },
    { media: '(prefers-color-scheme: dark)', color: '#15120f' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  for (const name of PRELOADED_FONTS) preload(`/fonts/v1/${name}.woff2`, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  return (
    // suppressHydrationWarning: the boot scripts set data-js and data-reading-level on <html> before hydration; React owns neither.
    // data-js is set before first paint so no-JavaScript fallbacks (.no-js-only) never flash.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.setAttribute('data-js','')" }} />
        <script dangerouslySetInnerHTML={{ __html: READING_LEVEL_BOOT_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">
          <DraftNotice className="draft-notice" />
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
