"use client";

import "./FeedBufferSkeleton.css";

/** Full-viewport placeholder while the next buffered card is still generating */
export default function FeedBufferSkeleton() {
  return (
    <article className="feed-buffer-skeleton" aria-busy="true">
      <div className="feed-buffer-skeleton__shimmer" />
      <p className="feed-buffer-skeleton__caption">Generating next card...</p>
    </article>
  );
}
