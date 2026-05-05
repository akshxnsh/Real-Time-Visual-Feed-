"use client";

import Link from "next/link";
import { useRef } from "react";
import TrendingCard from "./TrendingCard";
import "./TrendingSection.css";

/** @param {{ items: Array<{ id: number, topic: string, emoji: string, exploringLabel: string }>, onSelectTopic: (topic: string) => void, showUpdatedFlash: boolean, fading: boolean, onSeeAll?: () => void, seeAllHref?: string, isLoading?: boolean, sectionLabel?: string }} props */
export default function TrendingSection({
  items,
  onSelectTopic,
  showUpdatedFlash,
  fading,
  onSeeAll,
  seeAllHref,
  isLoading = false,
  sectionLabel = "🔥 Trending Now",
}) {
  const rootRef = useRef(null);

  const handleSeeAll = () => {
    if (onSeeAll) onSeeAll();
    else rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const showSkeleton = isLoading && (!items || items.length === 0);
  if (!showSkeleton && !items?.length) return null;

  const seeAllEl = seeAllHref ? (
    <Link href={seeAllHref} className="trending-section__see-all">
      See all trends →
    </Link>
  ) : (
    <button
      type="button"
      className="trending-section__see-all"
      onClick={handleSeeAll}
    >
      See all trends →
    </button>
  );

  return (
    <div
      ref={rootRef}
      id="trending-section"
      className={`trending-section ${fading ? "trending-section--fade" : ""}`}
    >
      <div className="trending-section__label-row">
        <div className="trending-section__label-group">
          <span className="trending-section__label">{sectionLabel}</span>
          {showUpdatedFlash && (
            <span className="trending-section__updated">Updated just now</span>
          )}
        </div>
        {seeAllEl}
      </div>
      {showSkeleton ? (
        <div className="trending-section__grid trending-section__grid--skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="trending-card-skeleton" aria-hidden />
          ))}
        </div>
      ) : (
        <div className="trending-section__grid">
          {(Array.isArray(items) ? items : []).map((row) => (
            <TrendingCard
              key={row.id}
              emoji={row.emoji}
              topic={row.topic}
              exploringLabel={row.exploringLabel}
              category={row.category}
              mediaType="text"
              onSelect={onSelectTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
}
