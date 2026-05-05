"use client";

import { useEffect, useRef, useState } from "react";
import "./ModeToggle.css";

const LEARN = "#4fc3f7";
const ENTERTAIN = "#ff6b8a";
const NEWS = "#ff3c3c";

export default function ModeToggle({ mode, onModeChange, disabled }) {
  const prevRef = useRef(mode);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (prevRef.current !== mode) {
      prevRef.current = mode;
      setFlash(mode);
      const t = window.setTimeout(() => setFlash(null), 300);
      return () => window.clearTimeout(t);
    }
    prevRef.current = mode;
  }, [mode]);

  const flashColor = flash === "entertain" ? ENTERTAIN : flash === "news" ? NEWS : LEARN;

  return (
    <div className="mode-toggle-shell">
      {flash != null && (
        <div
          className="mode-toggle-channel-flash"
          style={{ "--flash-color": flashColor }}
          aria-hidden
        />
      )}
      <div className="mode-toggle">
        <label className="toggle-label">Mode:</label>
        <div
          className={`toggle-track toggle-track--${mode}`}
          role="group"
          aria-label="Content mode"
        >
          <span
            className="toggle-slider"
            data-active={mode}
          />
          <button
            type="button"
            className={`toggle-btn ${mode === "learn" ? "active" : ""}`}
            onClick={() => onModeChange("learn")}
            disabled={disabled}
            aria-pressed={mode === "learn"}
          >
            📚 Learn
          </button>
          <button
            type="button"
            className={`toggle-btn ${mode === "entertain" ? "active" : ""}`}
            onClick={() => onModeChange("entertain")}
            disabled={disabled}
            aria-pressed={mode === "entertain"}
          >
            🎬 Entertain
          </button>
          <button
            type="button"
            className={`toggle-btn ${mode === "news" ? "active" : ""}`}
            onClick={() => onModeChange("news")}
            disabled={disabled}
            aria-pressed={mode === "news"}
          >
            📰 Live News
          </button>
        </div>
      </div>
    </div>
  );
}
