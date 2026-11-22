import Link from 'next/link';
import { REPO_URL } from '@/lib/content/site-url';
import { getGraph } from '@/lib/content/site';
import { visibleDebates } from '@/lib/content/debates';

// The archive-wide index routes are not prefetched; see NavLinks.
export default function Footer() {
  // The debates index is linked only once it lists something: owner approval publishes the first debate.
  const showDebates = visibleDebates(getGraph().debates).length > 0;
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
            <li><Link href="/kaalchakra" prefetch={false}>Kaalchakra</Link></li>
            <li><Link href="/archive" prefetch={false}>Archive</Link></li>
            <li><Link href="/learn" prefetch={false}>Learn</Link></li>
            {showDebates ? <li><Link href="/debates" prefetch={false}>Debates</Link></li> : null}
            <li><Link href="/search">Search</Link></li>
          </ul>
        </div>
        <div>
          <h2>How we know</h2>
          <ul>
            <li><Link href="/methodology">Methodology and evidence grades</Link></li>
            <li><Link href="/sources" prefetch={false}>Bibliography</Link></li>
            <li><Link href="/corrections" prefetch={false}>Corrections log</Link></li>
          </ul>
        </div>
        <div>
          <h2>Open</h2>
          <ul>
            <li><Link href="/data">Open data</Link></li>
            <li><a href={REPO_URL}>Source code (MIT)</a></li>
            <li><a href={`${REPO_URL}/issues/new?labels=content`}>Report an error</a></li>
            <li>Content licensed CC BY-SA 4.0</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
