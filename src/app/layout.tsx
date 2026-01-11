import type { Metadata } from "next";
import { Tiro_Devanagari_Hindi, Roboto } from 'next/font/google';
import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

const tiro = Tiro_Devanagari_Hindi({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-tiro',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: "The Bharat Repo",
  description: "A repository of knowledge about Bharatiya civilisation",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${tiro.variable} ${roboto.variable}`}>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
