import Link from 'next/link';
import SearchBar from './SearchBar';

export default function Header() {
  return (
    <header className="header">
      <Link href="/">
        <h1>The Bharat Repo</h1>
      </Link>
      <SearchBar />
      <nav>
        <Link href="/philosophy">Philosophy</Link>
        <Link href="/science">Science</Link>
        <Link href="/art-and-culture">Art & Culture</Link>
        <Link href="/history">History</Link>
        <Link href="/literature">Literature</Link>
        <Link href="/music">Music</Link>
      </nav>
    </header>
  );
}
