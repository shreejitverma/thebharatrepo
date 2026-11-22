'use client';

import { useState } from 'react';

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(url).then(
          () => setCopied(true),
          () => setCopied(false),
        )
      }
    >
      {copied ? 'Link copied' : 'Copy link'}
    </button>
  );
}
