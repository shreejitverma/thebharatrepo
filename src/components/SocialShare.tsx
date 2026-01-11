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
import { useState, useEffect } from 'react';

type SocialShareProps = {
  title: string;
  category: string;
  slug: string;
  tags: string[];
};

export default function SocialShare({ title, category, slug, tags }: SocialShareProps) {
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  return (
    <div className="social-share">
      <h4>Share this article:</h4>
      <div className="share-buttons">
        <FacebookShareButton url={shareUrl} hashtag={tags.length > 0 ? `#${tags[0]}` : undefined}>
          <FacebookIcon size={32} round />
        </FacebookShareButton>
        <TwitterShareButton url={shareUrl} title={title}>
          <TwitterIcon size={32} round />
        </TwitterShareButton>
        <LinkedinShareButton url={shareUrl} title={title}>
          <LinkedinIcon size={32} round />
        </LinkedinShareButton>
        <WhatsappShareButton url={shareUrl} title={title}>
          <WhatsappIcon size={32} round />
        </WhatsappShareButton>
        <button onClick={() => navigator.clipboard.writeText(shareUrl)}>
          Copy Link
        </button>
      </div>
    </div>
  );
}
