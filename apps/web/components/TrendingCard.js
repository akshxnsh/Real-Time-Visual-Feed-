"use client";

import "./TrendingCard.css";

const CATEGORY_ACCENT = {
  tech: "#7C6FF7",
  world: "#4FC3F7",
  entertainment: "#FF6B8A",
  science: "#81C784",
  sports: "#FFB74D",
  culture: "#4DB6AC",
};

function accentForCategory(category) {
  const c = typeof category === "string" ? category.toLowerCase() : "tech";
  return CATEGORY_ACCENT[c] || CATEGORY_ACCENT.tech;
}

function rgbChannels(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Trending topic tile — supports future video thumbnails.
 * Phase 3+: Switch mediaType to "video" when video generation is integrated.
 */
export default function TrendingCard({
  emoji,
  topic,
  exploringLabel,
  category = "tech",
  mediaType = "text",
  onSelect,
}) {
  const accent = accentForCategory(category);
  const pillLabel =
    typeof category === "string" ? category.toUpperCase() : "TECH";
  const [r, g, b] = rgbChannels(accent);

  return (
    <button
      type="button"
      className={`trending-card trending-card--${mediaType}`}
      style={{
        "--trend-accent": accent,
        "--trend-pill-bg": `rgba(${r},${g},${b},0.1)`,
        "--trend-hover-shadow": `0 10px 32px rgba(${r},${g},${b},0.28)`,
      }}
      onClick={() => onSelect(topic)}
    >
      {mediaType === "video" ? (
        <div className="trending-card__video-placeholder">
          <span className="trending-card__play" aria-hidden>
            ▶
          </span>
          {/* Phase 3+: replace with <video src={...} /> */}
        </div>
      ) : (
        <>
          <span className="trending-card__pill">{pillLabel}</span>
          <span className="trending-card__emoji" aria-hidden>
            {emoji}
          </span>
          <span className="trending-card__title">{topic}</span>
          <span className="trending-card__meta">{exploringLabel}</span>
        </>
      )}
    </button>
  );
}
