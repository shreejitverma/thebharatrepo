import Link from 'next/link';
import SearchBar from './SearchBar';
import NavLinks from './NavLinks';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="16" cy="16" r="4" fill="var(--gold)" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <line key={i} x1={16 + 6 * Math.cos(a)} y1={16 + 6 * Math.sin(a)} x2={16 + 12.5 * Math.cos(a)} y2={16 + 12.5 * Math.sin(a)} stroke="var(--accent)" strokeWidth="1.4" />;
      })}
    </svg>
  );
}

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" prefetch={false} className="brand" aria-label="The Bharat Repo, home">
          <BrandMark className="brand__mark" />
          <span className="brand__name">The Bharat Repo</span>
        </Link>
        <NavLinks />
        <SearchBar />
      </div>
    </header>
  );
}
