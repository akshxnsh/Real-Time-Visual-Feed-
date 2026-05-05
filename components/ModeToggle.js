"use client";

import "./ModeToggle.css";

export default function ModeToggle({ mode, onModeChange, disabled }) {
  return (
    <div className="mode-toggle">
      <label className="toggle-label">Mode:</label>
      <div className="toggle-buttons">
        <button
          className={`toggle-btn ${mode === "learn" ? "active" : ""}`}
          onClick={() => onModeChange("learn")}
          disabled={disabled}
          aria-pressed={mode === "learn"}
        >
          📚 Learn
        </button>
        <button
          className={`toggle-btn ${mode === "entertain" ? "active" : ""}`}
          onClick={() => onModeChange("entertain")}
          disabled={disabled}
          aria-pressed={mode === "entertain"}
        >
          🎬 Entertain
        </button>
        <button
          className={`toggle-btn ${mode === "news" ? "active" : ""}`}
          onClick={() => onModeChange("news")}
          disabled={disabled}
          aria-pressed={mode === "news"}
        >
          📰 Live News
        </button>
      </div>
    </div>
  );
}
