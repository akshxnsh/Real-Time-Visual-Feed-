"use client";

import "./ModeDividerCard.css";

export default function ModeDividerCard({ mode }) {
  const label = mode === "entertain" ? "ENTERTAIN" : "LEARN";
  const accentClass =
    mode === "entertain"
      ? "mode-divider-card--entertain"
      : "mode-divider-card--learn";

  return (
    <div className={`mode-divider-card ${accentClass}`} role="status">
      <div className="mode-divider-card__line" aria-hidden />
      <p className="mode-divider-card__text">
        Switched to {label}
      </p>
      <div className="mode-divider-card__line" aria-hidden />
    </div>
  );
}
