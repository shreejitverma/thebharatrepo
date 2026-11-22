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

const tiro = Tiro_Devanagari_Hindi({ subsets: ['latin', 'latin-ext', 'devanagari'], weight: ['400'], variable: '--font-tiro', display: 'swap' });
const serif = Noto_Serif({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
// Devanagari for names and terms in running text; downloaded only when Devanagari appears on a page.
const deva = Noto_Serif_Devanagari({ subsets: ['devanagari'], weight: ['400', '600'], variable: '--font-deva', display: 'swap', preload: false });
const sans = Noto_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '600', '700'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'The Bharat Repo: the evidence-based archive of Bharat', template: '%s | The Bharat Repo' },
  description:
    'The history, knowledge and living traditions of Bharat and Sanatana Dharma, every entry placed in time on the Kaalchakra and backed by graded, verifiable evidence.',
  icons: { icon: '/favicon.svg' },
  openGraph: { siteName: 'The Bharat Repo', type: 'website', locale: 'en_IN' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f1e6' },
    { media: '(prefers-color-scheme: dark)', color: '#12111c' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the boot script sets data-reading-level on <html> before hydration.
    <html lang="en" className={`${tiro.variable} ${serif.variable} ${sans.variable} ${deva.variable}`} suppressHydrationWarning>
      <head>
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
