"use client";

import "./SkeletonCard.css";

export default function SkeletonCard() {
  return (
    <article className="skeleton-card">
      <div className="skeleton-line skeleton-line-1"></div>
      <div className="skeleton-line skeleton-line-2"></div>
      <div className="skeleton-line skeleton-line-3"></div>
    </article>
  );
}
