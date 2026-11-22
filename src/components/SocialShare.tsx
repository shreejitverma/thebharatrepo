'use client';

import {
  FacebookShareButton,
  TwitterShareButton,
  LinkedinShareButton,
  WhatsappShareButton,
  FacebookIcon,
  TwitterIcon,
  LinkedinIcon,
  WhatsappIcon,
} from 'react-share';
import { useState } from 'react';
import { SITE_URL } from '@/lib/content/site-url';

type SocialShareProps = {
  title: string;
  category: string;
  slug: string;
  tags: string[];
};

export default function SocialShare({ title, category, slug, tags }: SocialShareProps) {
  const shareUrl = `${SITE_URL}/${category}/${slug}`;
  const hashtag = tags.length > 0 ? `#${tags[0].replace(/[^A-Za-z0-9]/g, '')}` : undefined;
  const [copied, setCopied] = useState(false);

  return (
    <div className="social-share">
      <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Share this article</h2>
      <div className="share-buttons">
        <FacebookShareButton aria-label="Share on Facebook" url={shareUrl} hashtag={hashtag}>
          <FacebookIcon size={32} round />
        </FacebookShareButton>
        <TwitterShareButton aria-label="Share on X" url={shareUrl} title={title}>
          <TwitterIcon size={32} round />
        </TwitterShareButton>
        <LinkedinShareButton aria-label="Share on LinkedIn" url={shareUrl} title={title}>
          <LinkedinIcon size={32} round />
        </LinkedinShareButton>
        <WhatsappShareButton aria-label="Share on WhatsApp" url={shareUrl} title={title}>
          <WhatsappIcon size={32} round />
        </WhatsappShareButton>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(shareUrl).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
