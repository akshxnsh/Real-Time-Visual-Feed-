"use client";

import "./DiscoverSidebar.css";

const POPULAR = [
  { name: "Black Holes", tag: "Science" },
  { name: "Fall of Rome", tag: "History" },
  { name: "Quantum Computing", tag: "Tech" },
  { name: "Ocean Depths", tag: "Nature" },
  { name: "AI Consciousness", tag: "Tech" },
];

const CATEGORIES = [
  { label: "Science", icon: "⬡" },
  { label: "History", icon: "⬡" },
  { label: "Tech", icon: "⬡" },
  { label: "Culture", icon: "⬡" },
  { label: "Space", icon: "⬡" },
  { label: "Psychology", icon: "⬡" },
  { label: "Nature", icon: "⬡" },
  { label: "Mystery", icon: "⬡" },
  { label: "Politics", icon: "⬡" },
  { label: "Health", icon: "⬡" },
  { label: "Economy", icon: "⬡" },
  { label: "Philosophy", icon: "⬡" },
];

const CURATED = [
  { name: "How the Internet Works", tag: "Tech" },
  { name: "The French Revolution", tag: "History" },
  { name: "CRISPR Gene Editing", tag: "Science" },
  { name: "Stoicism in Modern Life", tag: "Philosophy" },
];

export default function DiscoverSidebar({
  exploredEntries,
  onPopularSelect,
  onCategorySelect,
  onExploredSelect,
}) {
  const recent = Array.isArray(exploredEntries)
    ? exploredEntries.slice(0, 5)
    : [];

  return (
    <div className="discover-sidebar__inner">

      <div className="discover-section">
        <h3 className="discover-section__label">Popular right now</h3>
        <ul className="discover-popular">
          {POPULAR.map((item, i) => (
            <li key={item.name}>
              <button
                type="button"
                className="discover-popular__row"
                onClick={() => onPopularSelect(item.name)}
              >
                <span className="discover-popular__rank">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="discover-popular__meta">
                  <span className="discover-popular__name">{item.name}</span>
                  <span className="discover-popular__tag">{item.tag}</span>
                </span>
                <span className="discover-popular__arrow" aria-hidden>›</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="discover-section">
        <h3 className="discover-section__label">Curated picks</h3>
        <ul className="discover-curated">
          {CURATED.map((item) => (
            <li key={item.name}>
              <button
                type="button"
                className="discover-curated__row"
                onClick={() => onPopularSelect(item.name)}
              >
                <span className="discover-curated__dot" />
                <span className="discover-curated__meta">
                  <span className="discover-curated__name">{item.name}</span>
                  <span className="discover-curated__tag">{item.tag}</span>
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
              key={cat.label}
              type="button"
              className="discover-cat-chip"
              onClick={() => onCategorySelect(cat.label)}
            >
              {cat.label}
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
                  <span className={`discover-recent__dot discover-recent__dot--${entry.mode}`} aria-hidden />
                  <span className="discover-recent__topic">{entry.topic}</span>
                  <span className={`discover-recent__mode discover-recent__mode--${entry.mode}`}>
                    {entry.mode === "learn" ? "LEARN" : entry.mode === "news" ? "NEWS" : "ENTERTAIN"}
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
