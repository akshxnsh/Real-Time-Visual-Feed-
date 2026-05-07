"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import "./onboard.css";

const RECOMMENDED_TOPICS = [
  "AI",
  "Science",
  "Technology",
  "Space",
  "Mathematics",
  "Psychology",
  "Cinema",
  "Sports",
  "World News",
  "History",
  "Culture",
  "Finance",
  "Health",
  "Music",
  "Art",
  "Gaming",
  "Programming",
  "Philosophy",
  "Nature",
  "Food",
  "Travel",
];

export default function OnboardPage() {
  const router = useRouter();
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [customTopic, setCustomTopic] = useState("");

  // Minimal, interesting facts for visual appeal
  const FACTS = useMemo(() => [
    "Did you know? The shortest war in history lasted 38 minutes.",
    "Honey never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs.",
    "Octopuses have three hearts.",
    "Bananas are berries, but strawberries aren't.",
    "A day on Venus is longer than a year on Venus.",
    "There are more possible chess moves than atoms in the observable universe.",
    "Wombat poop is cube-shaped.",
    "The Eiffel Tower can be 15 cm taller during hot days.",
    "Some turtles can breathe through their butts.",
    "The unicorn is the national animal of Scotland.",
  ], []);
  // Always show the first fact on SSR, randomize only on client
  const [factIdx, setFactIdx] = useState(0);
  useEffect(() => {
    setFactIdx(Math.floor(Math.random() * FACTS.length));
  }, [FACTS.length]);


  const handleSelect = (topic) => {
    setSelected((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selected.length === 0) return;
    setSubmitting(true);
    // Save to localStorage (or send to backend if needed)
    localStorage.setItem("rtvf_onboarded", "1");
    localStorage.setItem("rtvf_topics", JSON.stringify(selected));
    // Set cookie for SSR onboarding detection (1 year expiry)
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `rtvf_onboarded=1; expires=${expires}; path=/`;
    setTimeout(() => {
      router.replace("/");
    }, 600); // Smooth transition
  };

  return (
    <div className="onboard-page">
      <div className="onboard-card">
        <div className="onboard-logo-wrap">
          <span className="onboard-logo-dot onboard-logo-dot--learn" />
          <span className="onboard-logo-dot onboard-logo-dot--entertain" />
        </div>
        <h1 className="onboard-title">Welcome to RTVF</h1>
        <p className="onboard-desc">
          Select your preferred topics to personalize your feed.<br />
          <span className="onboard-desc-secondary">You can change these later.</span>
        </p>
        <form className="onboard-form" onSubmit={handleSubmit}>
          <div className="onboard-topics">
            {RECOMMENDED_TOPICS.map((topic) => (
              <button
                type="button"
                key={topic}
                className={`onboard-topic-btn${selected.includes(topic) ? " onboard-topic-btn--selected" : ""}`}
                onClick={() => handleSelect(topic)}
                tabIndex={0}
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
              onChange={e => setCustomTopic(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && customTopic.trim()) {
                  e.preventDefault();
                  if (!selected.includes(customTopic.trim())) {
                    setSelected(prev => [...prev, customTopic.trim()]);
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
                  setSelected(prev => [...prev, customTopic.trim()]);
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
            disabled={selected.length === 0 || submitting}
          >
            {submitting ? "Loading..." : "Continue"}
          </button>
        </form>
        <div className="onboard-fact" aria-live="polite">
          <span className="onboard-fact-label">Fun Fact:</span> {FACTS[factIdx]}
        </div>
      </div>
    </div>
  );
}
