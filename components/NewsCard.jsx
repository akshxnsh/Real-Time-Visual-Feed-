"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import "./NewsCard.css";

export default function NewsCard({
  title,
  description,
  source,
  image,
  timestamp,
  category,
  url,
  onCardLeave = () => {},
  scrollRootRef = null,
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const cardRef = useRef(null);
  const cardMountTimeRef = useRef(Date.now());
  const observerRef = useRef(null);

  useEffect(() => {
    setIsAnimating(true);
  }, []);

  // Track when card leaves viewport and collect signals
  useEffect(() => {
    if (!cardRef.current || !scrollRootRef?.current) return;

    const root = scrollRootRef.current;
    let wasVisible = false;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          // Card is visible
          wasVisible = true;
        } else if (wasVisible) {
          // Card just left viewport - collect signals
          const timeOnCard = (Date.now() - cardMountTimeRef.current) / 1000; // seconds
          const completionRate = timeOnCard > 5 ? 100 : (timeOnCard / 5) * 100; // Assume 5s read time

          if (onCardLeave) {
            onCardLeave({
              title,
              category,
              mode: "news",
            }, {
              timeOnCard,
              completionRate: Math.min(100, completionRate),
              liked: isLiked,
              saved: isSaved,
              shared: false, // Would be tracked if share button clicked
            }, category);
          }

          wasVisible = false;
          // Reset timer for next visibility cycle
          cardMountTimeRef.current = Date.now();
        }
      },
      { root, threshold: 0.5 }
    );

    observerRef.current.observe(cardRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [title, category, isLiked, isSaved, onCardLeave, scrollRootRef]);

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const handleLike = useCallback(() => {
    setIsLiked((prev) => !prev);
  }, []);

  const handleSave = useCallback(() => {
    setIsSaved((prev) => !prev);
  }, []);

  const handleShare = useCallback(() => {
    // Native share API or fallback
    if (navigator.share) {
      navigator.share({
        title,
        text: description,
        url: url,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url);
    }
  }, [title, description, url]);

  return (
    <article className={`news-card ${isAnimating ? "animate-in" : ""}`} ref={cardRef}>
      {/* Breaking News Badge */}
      <div className="news-badge">
        <span className="pulse-dot"></span>
        LIVE NEWS
      </div>

      {/* News Image with Overlay */}
      {image && (
        <div className="news-image-wrapper">
          <img
            src={image}
            alt={title}
            className="news-image"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <div className="news-overlay"></div>
        </div>
      )}

      {/* News Content */}
      <div className="news-content">
        {/* Category Tag */}
        <div className="category-tag">{category || "News"}</div>

        {/* Title */}
        <h3 className="news-title">{title}</h3>

        {/* Description */}
        <p className="news-description">{description}</p>

        {/* Meta Information */}
        <div className="news-meta">
          <span className="source">{source}</span>
          <span className="separator">•</span>
          <span className="timestamp">{formatTime(timestamp)}</span>
        </div>

        {/* Read More Link */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="read-more"
        >
          Read Full Story →
        </a>
      </div>

      {/* Action Buttons */}
      <div className="news-actions">
        <button
          className={`action-btn like-btn ${isLiked ? "active" : ""}`}
          title="Like this news"
          onClick={handleLike}
        >
          👍
        </button>
        <button
          className={`action-btn save-btn ${isSaved ? "active" : ""}`}
          title="Save for later"
          onClick={handleSave}
        >
          🔖
        </button>
        <button
          className="action-btn share-btn"
          title="Share"
          onClick={handleShare}
        >
          📤
        </button>
      </div>
    </article>
  );
}
