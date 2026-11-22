import type { Metadata, Viewport } from 'next';
import { Tiro_Devanagari_Hindi, Noto_Serif, Noto_Sans, Noto_Serif_Devanagari } from 'next/font/google';
import './globals.css';
import '../styles/learning.css';
import '../styles/print.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import DraftNotice from '../components/DraftNotice';
import { SITE_URL } from '@/lib/content/site';
import { READING_LEVEL_BOOT_SCRIPT } from '@/lib/reading-level';

// `subsets` only selects what is preloaded; every subset stays in the @font-face rules and loads on demand through unicode-range.
// Preloading latin-ext and Devanagari as well cost about 670 KB on every page, though only IAST names and native-script names use them.
const tiro = Tiro_Devanagari_Hindi({ subsets: ['latin'], weight: ['400'], variable: '--font-tiro', display: 'swap' });
const serif = Noto_Serif({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
// Devanagari for names and terms in running text; downloaded only when Devanagari appears on a page.
// One static weight: names are never bold, and a weight range would fetch the variable font (twice the bytes).
const deva = Noto_Serif_Devanagari({ subsets: ['devanagari'], weight: ['400'], variable: '--font-deva', display: 'swap', preload: false });
const sans = Noto_Sans({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-sans', display: 'swap' });

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
  return (
    // suppressHydrationWarning: the boot scripts set data-js and data-reading-level on <html> before hydration; React owns neither.
    // data-js is set before first paint so no-JavaScript fallbacks (.no-js-only) never flash.
    <html lang="en" className={`${tiro.variable} ${serif.variable} ${sans.variable} ${deva.variable}`} suppressHydrationWarning>
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
