"use client";

import "./DiscoverSidebar.css";

const POPULAR = [
  "Black Holes",
  "Fall of Rome",
  "Quantum Computing",
  "Ocean Depths",
  "AI Consciousness",
];

const CATEGORIES = [
  "Science",
  "History",
  "Tech",
  "Culture",
  "Space",
  "Psychology",
  "Nature",
  "Mystery",
];

export default function DiscoverSidebar({
  exploredEntries,
  onPopularSelect,
  onCategorySelect,
  onExploredSelect,
}) {
  const recent = Array.isArray(exploredEntries)
    ? exploredEntries.slice(0, 3)
    : [];

  return (
    <div className="discover-sidebar__inner">
      <div className="discover-section">
        <h3 className="discover-section__label">Popular right now</h3>
        <ul className="discover-popular">
          {POPULAR.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                className="discover-popular__row"
                onClick={() => onPopularSelect(name)}
              >
                <span className="discover-popular__rank">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="discover-popular__name">{name}</span>
                <span className="discover-popular__arrow" aria-hidden>
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="discover-section">
        <h3 className="discover-section__label">Explore by category</h3>
        <div className="discover-cats">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className="discover-cat-chip"
              onClick={() => onCategorySelect(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="discover-section discover-section--recent">
        <h3 className="discover-section__label">Recently explored</h3>
        {recent.length === 0 ? (
          <p className="discover-recent__empty">
            Your explored topics will appear here
          </p>
        ) : (
          <ul className="discover-recent">
            {recent.map((entry) => (
              <li key={`${entry.topic}-${entry.timestamp}`}>
                <button
                  type="button"
                  className="discover-recent__row"
                  onClick={() => onExploredSelect(entry)}
                >
                  <span className="discover-recent__clock" aria-hidden>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#8888AA"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </span>
                  <span className="discover-recent__topic">{entry.topic}</span>
                  <span
                    className={`discover-recent__mode discover-recent__mode--${entry.mode}`}
                  >
                    {entry.mode === "learn" ? "LEARN" : "ENTERTAIN"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
