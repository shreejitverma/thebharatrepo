import type { Metadata, Viewport } from 'next';
import { Tiro_Devanagari_Hindi, Noto_Serif, Noto_Sans } from 'next/font/google';
import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import DraftNotice from '../components/DraftNotice';
import { SITE_URL } from '@/lib/content/site';

// `subsets` only selects what is preloaded; every subset stays in the @font-face rules and loads on demand through unicode-range.
// Preloading latin-ext and Devanagari as well cost about 670 KB on every page, though only IAST names and native-script names use them.
const tiro = Tiro_Devanagari_Hindi({ subsets: ['latin'], weight: ['400'], variable: '--font-tiro', display: 'swap' });
const serif = Noto_Serif({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
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
    { media: '(prefers-color-scheme: light)', color: '#f7f1e6' },
    { media: '(prefers-color-scheme: dark)', color: '#12111c' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${tiro.variable} ${serif.variable} ${sans.variable}`}>
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
