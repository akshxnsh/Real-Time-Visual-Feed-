"use client";

import "./SavedDrawer.css";

/** @param {{ open: boolean, onClose: () => void, saved: import("../lib/rtvlfStorage").RtvlfCardRecord[], onUnsave: (rec: import("../lib/rtvlfStorage").RtvlfCardRecord) => void }} props */
export default function SavedDrawer({ open, onClose, saved, onUnsave }) {
  return (
    <>
      <div
        className={`saved-drawer-backdrop ${open ? "saved-drawer-backdrop--open" : ""}`}
        aria-hidden={!open}
        onClick={onClose}
      />
      <aside
        className={`saved-drawer ${open ? "saved-drawer--open" : ""}`}
        aria-hidden={!open}
        aria-label="Saved cards"
      >
        <div className="saved-drawer__head">
          <h2 className="saved-drawer__title">Saved</h2>
          <button
            type="button"
            className="saved-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="saved-drawer__body">
          {saved.length === 0 ? (
            <p className="saved-drawer__empty">
              No saved cards yet. Bookmark cards you want to revisit.
            </p>
          ) : (
            <ul className="saved-drawer__list">
              {saved.map((rec) => (
                <li key={`${rec.timestamp}-${rec.id}`} className="saved-drawer__item">
                  <div className="saved-card-compact">
                    <span className="saved-card-compact__badge">{rec.topic}</span>
                    <p className="saved-card-compact__text">
                      {(rec.text || "").slice(0, 80)}
                      {(rec.text || "").length > 80 ? "…" : ""}
                    </p>
                    <time
                      className="saved-card-compact__time"
                      dateTime={new Date(rec.timestamp).toISOString()}
                    >
                      {new Date(rec.timestamp).toLocaleString()}
                    </time>
                    <button
                      type="button"
                      className="saved-card-compact__unsave"
                      onClick={() => onUnsave(rec)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
