"use client";

import { useEffect, useRef, useState } from "react";
import "./VideoCard.css";

export default function VideoCard({
  videoUrl,
  topic,
  mode,
  cardNumber = 1,
  totalCards = 1,
  showTrendingBadge = false,
  isLiked = false,
  isSaved = false,
  likeCount = 0,
  onToggleLike = () => {},
  onToggleSave = () => {},
  onCardLeave = () => {},
  scrollRootRef = null,
}) {
  const videoRef = useRef(null);
  const cardRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [watched, setWatched] = useState(0);
  const [replays, setReplays] = useState(0);
  const observerRef = useRef(null);

  // Handle pause when out of view
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !scrollRootRef?.current) return;

    const root = scrollRootRef.current;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          // Card is visible, play video
          videoElement.play();
          setIsPlaying(true);
        } else {
          // Card is out of view, pause video
          videoElement.pause();
          setIsPlaying(false);

          // Collect watch time and replays before leaving
          if (onCardLeave) {
            onCardLeave(
              {
                videoUrl,
                topic,
                mode,
              },
              {
                watchedDuration: watched,
                replays,
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
  }, [videoUrl, topic, mode, watched, replays, onCardLeave, scrollRootRef]);

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

  const modeLabel = mode === "learn" ? "📚 Learn" : "🎬 Entertain";
  const modeColor = mode === "learn" ? "learn-badge" : "entertain-badge";

  return (
    <article className="video-card" ref={cardRef}>
      {/* Trending Badge */}
      {showTrendingBadge && (
        <div className="trending-badge">
          <span className="trend-icon">🔥</span> TRENDING
        </div>
      )}

      {/* Video Container */}
      <div className="video-container">
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

        {/* Card Counter */}
        <div className="card-counter">
          {cardNumber} / {totalCards}
        </div>
      </div>

      {/* Card Info */}
      <div className="video-info">
        {/* Topic */}
        <h3 className="video-topic">{topic}</h3>

        {/* Stats Row */}
        <div className="video-stats">
          <span className="stat-item">
            👁️ {watched}% watched
          </span>
          <span className="stat-separator">•</span>
          <span className="stat-item">
            🔄 {replays} replays
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="video-actions">
        <button
          className={`action-btn like-btn ${isLiked ? "active" : ""}`}
          onClick={() => onToggleLike()}
          title="Like this video"
        >
          👍 {likeCount > 0 ? likeCount : ""}
        </button>
        <button
          className={`action-btn save-btn ${isSaved ? "active" : ""}`}
          onClick={() => onToggleSave()}
          title="Save for later"
        >
          🔖
        </button>
        <button
          className="action-btn share-btn"
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: topic,
                text: `Check out this ${mode} video about ${topic}!`,
                url: window.location.href,
              });
            }
          }}
          title="Share"
        >
          📤
        </button>
      </div>
    </article>
  );
}
