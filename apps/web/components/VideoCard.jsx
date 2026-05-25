"use client";

import { useEffect, useRef, useState } from "react";
import "./VideoCard.css";

/* ── Inline SVG icons (no external dependency) ─────────── */
const IconFlame = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.66 11.2c-.23-.3-.51-.56-.77-.82-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32-2.59 2.08-3.61 5.75-2.39 8.9.04.1.08.2.08.33 0 .22-.15.42-.35.5-.23.1-.49.04-.67-.14-.06-.06-.1-.13-.15-.21A10.82 10.82 0 0 1 7.5 8c-1.55 1.55-2.5 3.6-2.5 5.79C5 18.38 8.62 22 13 22c4.43 0 8-3.62 8-8.04 0-2.17-.88-4.31-2.34-5.76l-1-.1z" />
  </svg>
);

const IconEye = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconRepeat = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const IconThumbUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

const IconThumbDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
  </svg>
);

const IconBookmark = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const IconPlay = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

export default function VideoCard({
  videoUrl,
  topic,
  caption,
  mode,
  cardNumber = 1,
  totalCards = 1,
  showTrendingBadge = false,
  isLiked = false,
  isDisliked = false,
  isSaved = false,
  likeCount = 0,
  onToggleLike = () => {},
  onToggleDislike = () => {},
  onToggleSave = () => {},
  onCardLeave = () => {},
  scrollRootRef = null,
}) {
  const videoRef = useRef(null);
  const cardRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [manualPause, setManualPause] = useState(false);
  const [watched, setWatched] = useState(0);
  const [replays, setReplays] = useState(0);
  const observerRef = useRef(null);

  // Keep refs in sync so the observer callback always reads fresh values
  // without the observer needing to be torn down on every state change.
  const manualPauseRef = useRef(manualPause);
  const watchedRef = useRef(watched);
  const replaysRef = useRef(replays);
  const onCardLeaveRef = useRef(onCardLeave);

  useEffect(() => { manualPauseRef.current = manualPause; }, [manualPause]);
  useEffect(() => { watchedRef.current = watched; }, [watched]);
  useEffect(() => { replaysRef.current = replays; }, [replays]);
  useEffect(() => { onCardLeaveRef.current = onCardLeave; }, [onCardLeave]);

  // Handle pause when out of view — depends only on stable identifiers so
  // the observer is never torn down while the card is actively playing.
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !scrollRootRef?.current) return;

    const root = scrollRootRef.current;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          // Only auto-play if the user hasn't manually paused
          if (!manualPauseRef.current) {
            videoElement.play();
            setIsPlaying(true);
          }
        } else {
          // Card is out of view, pause video
          videoElement.pause();
          setIsPlaying(false);

          // Collect watch time and replays before leaving
          const leave = onCardLeaveRef.current;
          if (leave) {
            const categories = [topic ? topic.toLowerCase() : "general"];
            leave(
              { videoUrl, topic, mode, categories },
              {
                watchedDuration: watchedRef.current,
                replays: replaysRef.current,
                completionRate: watchedRef.current,
              }
            );
          }
        }
      },
      { root, threshold: 0.5 }
    );

    observerRef.current.observe(cardRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [videoUrl, topic, mode, scrollRootRef]);

  // Track watch progress
  const handleTimeUpdate = (e) => {
    const duration = e.target.duration;
    const currentTime = e.target.currentTime;
    if (duration > 0) {
      setWatched(Math.round((currentTime / duration) * 100));
    }
  };

  // Track replays
  const handleReplay = () => {
    setReplays((prev) => prev + 1);
  };

  // Click on video area toggles manual pause
  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (manualPause) {
      video.play();
      setManualPause(false);
      setIsPlaying(true);
    } else {
      video.pause();
      setManualPause(true);
      setIsPlaying(false);
    }
  };

  const modeLabel = mode === "learn" ? "LEARN" : mode === "news" ? "NEWS" : "ENTERTAIN";
  const modeColor =
    mode === "learn" ? "learn-badge" : mode === "news" ? "news-badge" : "entertain-badge";

  return (
    <article className="video-card" ref={cardRef}>
      {/* Trending Badge */}
      {showTrendingBadge && (
        <div className="trending-badge">
          <IconFlame />
          TRENDING
        </div>
      )}

      {/* Video Container */}
      <div className="video-container" onClick={handleVideoClick}>
        <video
          ref={videoRef}
          className="video-player"
          autoPlay
          muted
          loop
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleReplay}
          poster="/video-poster.png"
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Watch Progress Bar */}
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${watched}%` }}></div>
        </div>

        {/* Mode Badge */}
        <div className={`mode-badge ${modeColor}`}>{modeLabel}</div>

        {/* Manual pause overlay */}
        {manualPause && (
          <div className="pause-overlay" aria-label="Resume video">
            <div className="pause-overlay__btn">
              <IconPlay />
            </div>
          </div>
        )}
      </div>

      {/* Caption Strip */}
      <div className="video-caption">
        <h3 className="caption-title">{caption || topic}</h3>
        <div className="caption-stats">
          <span className="stat-pill"><IconEye /> {watched}%</span>
          <span className="stat-pill"><IconRepeat /> {replays}×</span>
        </div>
      </div>

      {/* Action Strip */}
      <div className="video-actions">
        <button
          className={`action-btn like-btn ${isLiked ? "active" : ""}`}
          onClick={() => onToggleLike()}
          title="Like"
          aria-label="Like this video"
        >
          <span className="action-icon"><IconThumbUp /></span>
          <span className="action-label">{isLiked ? "Liked" : "Like"}{likeCount > 0 ? ` · ${likeCount}` : ""}</span>
        </button>
        <button
          className={`action-btn dislike-btn ${isDisliked ? "active" : ""}`}
          onClick={() => onToggleDislike()}
          title="Dislike"
          aria-label="Dislike this video"
        >
          <span className="action-icon"><IconThumbDown /></span>
          <span className="action-label">{isDisliked ? "Disliked" : "Dislike"}</span>
        </button>
        <button
          className={`action-btn save-btn ${isSaved ? "active" : ""}`}
          onClick={() => onToggleSave()}
          title="Save topic"
          aria-label="Save this topic"
        >
          <span className="action-icon"><IconBookmark filled={isSaved} /></span>
          <span className="action-label">{isSaved ? "Saved" : "Save"}</span>
        </button>
      </div>
    </article>
  );
}
