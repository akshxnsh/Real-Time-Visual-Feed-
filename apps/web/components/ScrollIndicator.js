"use client";

import "./ScrollIndicator.css";

export default function ScrollIndicator({ visible, faded }) {
  return (
    <div
      className={`scroll-indicator ${visible ? "visible" : ""} ${faded ? "faded" : ""}`}
      aria-hidden="true"
    >
      <span className="scroll-indicator-stack">
        <svg
          className="scroll-indicator-chevron scroll-indicator-chevron--bottom"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
        <svg
          className="scroll-indicator-chevron scroll-indicator-chevron--top"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  );
}
