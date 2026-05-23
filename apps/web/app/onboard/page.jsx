"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import "./onboard.css";
import { seedProfile, saveProfile } from "../../../../services/sentiment.js";
import { saveGenres } from "../../lib/rtvfStorage.js";

const RECOMMENDED_TOPICS = [
  "AI", "Science", "Technology", "Space", "Mathematics",
  "Psychology", "Cinema", "Sports", "World News", "History",
  "Culture", "Finance", "Health", "Music", "Art",
  "Gaming", "Programming", "Philosophy", "Nature", "Food", "Travel",
];

const GENRES = [
  { label: "Documentary", emoji: "🎬" },
  { label: "Educational", emoji: "📚" },
  { label: "Thriller",    emoji: "😰" },
  { label: "Comedy",      emoji: "😂" },
  { label: "Action",      emoji: "💥" },
  { label: "Mystery",     emoji: "🔍" },
  { label: "Sci-Fi",      emoji: "🚀" },
  { label: "Nature",      emoji: "🌿" },
  { label: "Horror",      emoji: "👻" },
  { label: "Romance",     emoji: "💕" },
  { label: "History",     emoji: "🏛️" },
  { label: "Sports",      emoji: "⚡" },
];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = topics, 2 = genres
  const [selected, setSelected] = useState([]);       // chosen topics
  const [selectedGenres, setSelectedGenres] = useState([]); // chosen genres
  const [submitting, setSubmitting] = useState(false);
  const [customTopic, setCustomTopic] = useState("");
  const [stepping, setStepping] = useState(false); // transition animation

  const handleSelectTopic = (topic) => {
    setSelected((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleSelectGenre = (genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (selected.length === 0) return;
    setStepping(true);
    setTimeout(() => {
      setStep(2);
      setStepping(false);
    }, 280);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedGenres.length === 0) return;
    setSubmitting(true);

    // Seed initial sentiment profile from onboarding choices
    const seededProfile = seedProfile(selected, selectedGenres);
    saveProfile(seededProfile);

    // Persist genres and topics
    saveGenres(selectedGenres);
    localStorage.setItem("rtvf_topics", JSON.stringify(selected));
    localStorage.setItem("rtvf_onboarded", "1");

    // Set cookie for SSR onboarding detection (1 year expiry)
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `rtvf_onboarded=1; expires=${expires}; path=/`;

    setTimeout(() => {
      router.replace("/");
    }, 500);
  };

  return (
    <div className="onboard-page">
      <div className={`onboard-card${stepping ? " onboard-card--stepping" : ""}`}>

        {/* Logo */}
        <div className="onboard-logo-wrap">
          <span className="onboard-logo-dot onboard-logo-dot--learn" />
          <span className="onboard-logo-dot onboard-logo-dot--entertain" />
        </div>

        {/* Step indicator */}
        <div className="onboard-steps" aria-label="Step indicator">
          <div className={`onboard-step-dot${step === 1 ? " onboard-step-dot--active" : ""}`}>
            <span>1</span>
          </div>
          <div className="onboard-step-line" />
          <div className={`onboard-step-dot${step === 2 ? " onboard-step-dot--active" : ""}`}>
            <span>2</span>
          </div>
        </div>

        {/* ── STEP 1: Topics ────────────────────────────────── */}
        {step === 1 && (
          <>
            <h1 className="onboard-title">Welcome to RTVF</h1>
            <p className="onboard-desc">
              Pick topics you love. We&apos;ll personalize your feed around them.
              <br />
              <span className="onboard-desc-secondary">Select as many as you like.</span>
            </p>
            <form className="onboard-form" onSubmit={handleNextStep}>
              <div className="onboard-topics">
                {RECOMMENDED_TOPICS.map((topic) => (
                  <button
                    type="button"
                    key={topic}
                    className={`onboard-topic-btn${selected.includes(topic) ? " onboard-topic-btn--selected" : ""}`}
                    onClick={() => handleSelectTopic(topic)}
                  >
                    {topic}
                  </button>
                ))}
              </div>
              <div className="onboard-custom-topic-row">
                <input
                  type="text"
                  className="onboard-custom-topic-input"
                  placeholder="Add a custom topic..."
                  value={customTopic}
                  maxLength={32}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customTopic.trim()) {
                      e.preventDefault();
                      if (!selected.includes(customTopic.trim())) {
                        setSelected((prev) => [...prev, customTopic.trim()]);
                      }
                      setCustomTopic("");
                    }
                  }}
                />
                <button
                  type="button"
                  className="onboard-custom-topic-add-btn"
                  disabled={!customTopic.trim() || selected.includes(customTopic.trim())}
                  onClick={() => {
                    if (customTopic.trim() && !selected.includes(customTopic.trim())) {
                      setSelected((prev) => [...prev, customTopic.trim()]);
                      setCustomTopic("");
                    }
                  }}
                >
                  Add
                </button>
              </div>
              <button
                type="submit"
                className="onboard-submit-btn"
                disabled={selected.length === 0}
              >
                Continue →
              </button>
            </form>
          </>
        )}

        {/* ── STEP 2: Genres ────────────────────────────────── */}
        {step === 2 && (
          <>
            <h1 className="onboard-title">What genres do you love?</h1>
            <p className="onboard-desc">
              We&apos;ll shape the style, pacing and tone of your feed.
              <br />
              <span className="onboard-desc-secondary">Pick everything that resonates.</span>
            </p>
            <form className="onboard-form" onSubmit={handleSubmit}>
              <div className="onboard-genres">
                {GENRES.map(({ label, emoji }) => (
                  <button
                    type="button"
                    key={label}
                    className={`onboard-genre-btn${selectedGenres.includes(label) ? " onboard-genre-btn--selected" : ""}`}
                    onClick={() => handleSelectGenre(label)}
                  >
                    <span className="onboard-genre-emoji" aria-hidden>{emoji}</span>
                    <span className="onboard-genre-label">{label}</span>
                  </button>
                ))}
              </div>
              <div className="onboard-genre-actions">
                <button
                  type="button"
                  className="onboard-back-btn"
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  className="onboard-submit-btn onboard-submit-btn--primary"
                  disabled={selectedGenres.length === 0 || submitting}
                >
                  {submitting ? "Setting up…" : "Start Exploring →"}
                </button>
              </div>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
