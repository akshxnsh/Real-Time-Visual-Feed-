"use client";

import "./FeedErrorCard.css";

export default function FeedErrorCard({ onRetry }) {
  return (
    <article className="feed-error-card" role="alert">
      <button
        type="button"
        className="feed-error-retry"
        onClick={onRetry}
        aria-label="Try again"
      >
        <svg
          className="feed-error-retry-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 4v6h-6" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </button>
      <p className="feed-error-text">
        Couldn&apos;t generate this card. Scroll to try again.
      </p>
    </article>
  );
}
