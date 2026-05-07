"use client";

import { useEffect, useRef, useState } from "react";
import { updateProfile } from "../../../services/sentiment.js";
import "./FeedCard.css";

function HeartIcon({ filled }) {
  return (
    <svg
      className="card-action-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function BookmarkIcon({ filled }) {
  return (
    <svg
      className="card-action-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ThumbsDownIcon({ filled }) {
  return (
    <svg
      className="card-action-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

export default function FeedCard({
  text,
  cardNumber,
  topic,
  mode,
  scrollRootRef,
  showTrendingBadge,
  isLiked = false,
  isDisliked = false,
  isSaved = false,
  likeCount = 0,
  onToggleLike,
  onToggleDislike,
  onToggleSave,
  onCardLeave,
}) {
  const rootRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [dislikeAnimating, setDislikeAnimating] = useState(false);
  const [saveAnimating, setSaveAnimating] = useState(false);
  
  // Signal tracking refs
  const signalTracker = useRef({
    completionRate: 0,
    replayCount: 0,
    scrolledAwayAt: 0,
    liked: false,
    disliked: false,
    saved: false,
    shared: false,
  });

  useEffect(() => {
    const el = rootRef.current;
    const root = scrollRootRef?.current;
    if (!el || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.45) {
          setInView(true);
        } else if (inView && !entry.isIntersecting) {
          // Card left view — finalize signals and call callback
          setInView(false);
          if (onCardLeave) {
            onCardLeave({
              topic,
              mode,
              categories: [topic.toLowerCase()], // Simple categorization
              signals: signalTracker.current,
            });
          }
        }
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRootRef, inView, topic, mode, onCardLeave]);

  const handleLike = (e) => {
    e.stopPropagation();
    setLikeAnimating(true);
    window.setTimeout(() => setLikeAnimating(false), 320);
    // Track explicit like signal; liking clears dislike
    signalTracker.current.liked = !isLiked;
    if (!isLiked) signalTracker.current.disliked = false;
    onToggleLike();
  };

  const handleDislike = (e) => {
    e.stopPropagation();
    setDislikeAnimating(true);
    window.setTimeout(() => setDislikeAnimating(false), 320);
    // Track explicit dislike signal; disliking clears like
    signalTracker.current.disliked = !isDisliked;
    if (!isDisliked) signalTracker.current.liked = false;
    onToggleDislike();
  };

  const handleSave = (e) => {
    e.stopPropagation();
    setSaveAnimating(true);
    window.setTimeout(() => setSaveAnimating(false), 220);
    // Track explicit save signal
    signalTracker.current.saved = !isSaved;
    onToggleSave();
  };

  const modeKey = mode === "entertain" ? "entertain" : "learn";

  return (
    <article
      ref={rootRef}
      className={`card card--${modeKey} ${inView ? "card--in-view" : ""} ${showTrendingBadge ? "card--has-trending" : ""}`}
    >
      <div className="card-accent-clip" aria-hidden>
        <div className="card-accent-line" />
      </div>

      <div className="card-label">
        <span className="card-topic">{topic}</span>
        <span className={`card-number ${inView ? "card-number--pulse-once" : ""}`}>
          · Card {cardNumber}
        </span>
      </div>

      {showTrendingBadge && (
        <div className="card-trending-badge" title="Trending topic">
          🔥 Trending
        </div>
      )}

      <div className={`card-mode-badge card-mode-badge--${modeKey}`}>
        <span className="card-mode-badge__icon" aria-hidden>
          {modeKey === "learn" ? "📖" : "⚡"}
        </span>
        <span>{mode === "learn" ? "LEARN" : "ENTERTAIN"}</span>
      </div>

      <div className="card-content">
        <p>{text}</p>
      </div>

      <div className="card-actions">
        <button
          type="button"
          className={`card-actions__like ${isLiked ? "card-actions__like--on" : ""} ${likeAnimating ? "card-actions__like--burst" : ""}`}
          onClick={handleLike}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Unlike" : "Like"}
        >
          <HeartIcon filled={isLiked} />
        </button>
        <span className="card-actions__count" aria-live="polite">
          {likeCount}
        </span>
        <button
          type="button"
          className={`card-actions__dislike ${isDisliked ? "card-actions__dislike--on" : ""} ${dislikeAnimating ? "card-actions__dislike--burst" : ""}`}
          onClick={handleDislike}
          aria-pressed={isDisliked}
          aria-label={isDisliked ? "Remove dislike" : "Dislike"}
        >
          <ThumbsDownIcon filled={isDisliked} />
        </button>
        <button
          type="button"
          className={`card-actions__save ${isSaved ? "card-actions__save--on" : ""} ${saveAnimating ? "card-actions__save--pop" : ""}`}
          onClick={handleSave}
          aria-pressed={isSaved}
          aria-label={isSaved ? "Remove bookmark" : "Save"}
        >
          <BookmarkIcon filled={isSaved} />
        </button>
      </div>
    </article>
  );
}
