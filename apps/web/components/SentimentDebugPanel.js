"use client";

import { useEffect, useState } from "react";
import { loadProfile, resetProfile, getProfileDebugInfo } from "../../../services/sentiment.js";
import "./SentimentDebugPanel.css";

export default function SentimentDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Shift + P opens the debug panel
      if (e.shiftKey && e.key === "P") {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) {
            const profile = loadProfile();
            setProfileData(getProfileDebugInfo(profile));
          }
          return !prev;
        });
      }
      // Escape closes it
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleRefresh = () => {
    const profile = loadProfile();
    setProfileData(getProfileDebugInfo(profile));
  };

  const handleReset = () => {
    if (window.confirm("Reset sentiment profile? This cannot be undone.")) {
      resetProfile();
      setProfileData(getProfileDebugInfo({}));
      setIsOpen(false);
    }
  };

  if (!isOpen || !profileData) return null;

  // Only show in development
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="sentiment-debug-panel">
      <div className="sentiment-debug-panel__backdrop" onClick={() => setIsOpen(false)} />
      
      <div className="sentiment-debug-panel__modal">
        <div className="sentiment-debug-panel__header">
          <h2>Sentiment Profile Debug</h2>
          <button
            className="sentiment-debug-panel__close"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="sentiment-debug-panel__content">
          {/* Confidence & Stats */}
          <section>
            <h3>Profile Strength</h3>
            <div className="stat-row">
              <span className="stat-label">Confidence:</span>
              <span className="stat-value">{(profileData.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="confidence-bar">
              <div
                className="confidence-bar__fill"
                style={{ width: `${profileData.confidence * 100}%` }}
              />
            </div>
            <div className="stat-row">
              <span className="stat-label">Videos Watched:</span>
              <span className="stat-value">{profileData.videosWatched}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Likes:</span>
              <span className="stat-value">{profileData.likes}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Saves:</span>
              <span className="stat-value">{profileData.saves}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Last Updated:</span>
              <span className="stat-value">{profileData.lastUpdated}</span>
            </div>
          </section>

          {/* Top Preferences */}
          <section>
            <h3>Top Topics</h3>
            <div className="tags">
              {profileData.topTopics.map((topic) => (
                <span key={topic} className="tag">
                  {topic.charAt(0).toUpperCase() + topic.slice(1)}
                </span>
              ))}
            </div>
          </section>

          {/* Dominant Preferences */}
          <section>
            <h3>Current Preferences</h3>
            <div className="stat-row">
              <span className="stat-label">Style:</span>
              <span className="stat-value">{profileData.dominantStyle}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Depth:</span>
              <span className="stat-value">{profileData.depthPreference}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Pacing:</span>
              <span className="stat-value">{profileData.pacingPreference}</span>
            </div>
          </section>

          {/* All Scores */}
          <section>
            <h3>All Topic Affinities</h3>
            <div className="scores-grid">
              {Object.entries(profileData.allScores.topics).map(([topic, score]) => (
                <div key={topic} className="score-bar">
                  <div className="score-bar__label">{topic}</div>
                  <div className="score-bar__track">
                    <div
                      className="score-bar__fill"
                      style={{ width: `${score * 100}%` }}
                    />
                  </div>
                  <div className="score-bar__value">{(score * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </section>

          {/* Style Scores */}
          <section>
            <h3>Style Preferences</h3>
            <div className="scores-grid">
              {Object.entries(profileData.allScores.styles).map(([style, score]) => (
                <div key={style} className="score-bar">
                  <div className="score-bar__label">{style}</div>
                  <div className="score-bar__track">
                    <div
                      className="score-bar__fill"
                      style={{ width: `${score * 100}%` }}
                    />
                  </div>
                  <div className="score-bar__value">{(score * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="sentiment-debug-panel__footer">
          <button className="btn btn--primary" onClick={handleRefresh}>
            Refresh
          </button>
          <button className="btn btn--secondary" onClick={handleReset}>
            Reset Profile
          </button>
          <button className="btn btn--tertiary" onClick={() => setIsOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
