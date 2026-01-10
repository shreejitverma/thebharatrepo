import Link from 'next/link';

export default function Header() {
  return (
    <header className="header">
      <Link href="/">
        <h1>The Bharat Repo</h1>
      </Link>
      <nav>
        <Link href="/philosophy-and-scriptures">Philosophy & Scriptures</Link>
        <Link href="/science-and-technology">Science & Technology</Link>
        <Link href="/art-and-culture">Art & Culture</Link>
      </nav>
    </header>
  );
}
