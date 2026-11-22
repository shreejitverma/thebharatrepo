import Link from 'next/link';

/** States the editorial status of all content; shown on every page and in the Kaalchakra panel. */
export default function DraftNotice({ className }: { className: string }) {
  return (
    <p className={className}>
      Entries are drafted by AI models with machine-verified sources and are awaiting human editorial review. <Link href="/methodology">How we check</Link>
    </p>
  );
}
