import Link from 'next/link';
import { REPO_URL } from '@/lib/content/site-url';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <h2>The Bharat Repo</h2>
          <p style={{ margin: 0 }}>The evidence-based archive of Bharat and Sanatana Dharma. Every entry placed in time, every claim graded and sourced.</p>
        </div>
        <div>
          <h2>Explore</h2>
          <ul>
            <li><Link href="/kaalchakra">Kaalchakra</Link></li>
            <li><Link href="/archive">Archive</Link></li>
            <li><Link href="/search">Search</Link></li>
          </ul>
        </div>
        <div>
          <h2>How we know</h2>
          <ul>
            <li><Link href="/methodology">Methodology and evidence grades</Link></li>
            <li><Link href="/sources">Bibliography</Link></li>
            <li><Link href="/corrections">Corrections log</Link></li>
          </ul>
        </div>
        <div>
          <h2>Open</h2>
          <ul>
            <li><a href={REPO_URL}>Source code (MIT)</a></li>
            <li><a href={`${REPO_URL}/issues/new?labels=content`}>Report an error</a></li>
            <li>Content licensed CC BY-SA 4.0</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
