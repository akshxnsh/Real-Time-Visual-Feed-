"use client";

import styles from "./TrendCard.module.css";

const CAT_HEX = {
  tech: "#7C6FF7",
  world: "#4FC3F7",
  entertainment: "#FF6B8A",
  science: "#81C784",
  sports: "#FFB74D",
  culture: "#4DB6AC",
};

export default function TrendCard({
  name,
  category,
  tweetVolume,
  rank,
  onClick,
}) {
  const slug = (category || "world").toLowerCase();
  const accent = CAT_HEX[slug] || CAT_HEX.world;
  const pillBg = accent.length === 7 ? `${accent}26` : "rgba(124, 111, 247, 0.12)";

  const volLabel =
    tweetVolume != null && tweetVolume > 0
      ? tweetVolume >= 1_000_000
        ? `${(tweetVolume / 1_000_000).toFixed(1)}M people exploring`
        : tweetVolume >= 1000
          ? `${(tweetVolume / 1000).toFixed(1)}k people exploring`
          : `${tweetVolume} people exploring`
      : "Trending";

  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.btn}
      style={{
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <span
        className={styles.pill}
        style={{ color: accent, backgroundColor: pillBg }}
      >
        {slug}
      </span>
      <span className={styles.rank}>#{rank}</span>
      <span className={styles.title}>{name}</span>
      <span className={styles.vol}>{volLabel}</span>
      <span className={styles.cta}>Explore →</span>
    </button>
  );
}
