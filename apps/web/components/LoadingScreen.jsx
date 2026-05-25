"use client";

import { useEffect, useState } from "react";
import "./LoadingScreen.css";

export default function LoadingScreen({
  visible = true,
  videosLoading = 0,
  videosTotal = 3,
  onDismiss = () => {},
}) {
  const [loadingPercentage, setLoadingPercentage] = useState(0);

  useEffect(() => {
    if (videosTotal > 0) {
      const percentage = (videosLoading / videosTotal) * 100;
      setLoadingPercentage(percentage);

      // When all videos are loaded, show BLINK for 3 seconds before dismissing
      if (videosLoading >= videosTotal) {
        const timer = setTimeout(() => {
          onDismiss();
        }, 3000); // 3 seconds
        return () => clearTimeout(timer);
      }
    }
  }, [videosLoading, videosTotal, onDismiss]);

  if (!visible) return null;

  return (
    <div className="loading-screen">
      {/* BLINK with two animated dots */}
      <div className="blink-label">
        <span className="blink-text">BLINK</span>
        <span className="blink-dot blink-dot-1">.</span>
        <span className="blink-dot blink-dot-2">.</span>
      </div>
      <div className="loading-container">
        {/* Main Loading Indicator */}
        <div className="loading-indicator">
          <div className="loading-dots">
            {/* Dot 1 */}
            <div
              className={`dot dot-1 ${videosLoading >= 1 ? "filled" : ""}`}
            >
              <span className="dot-inner">●</span>
              <span className="dot-label">1</span>
            </div>

            {/* Dot 2 */}
            <div
              className={`dot dot-2 ${videosLoading >= 2 ? "filled" : ""}`}
            >
              <span className="dot-inner">●</span>
              <span className="dot-label">2</span>
            </div>

            {/* Dot 3 */}
            <div
              className={`dot dot-3 ${videosLoading >= 3 ? "filled" : ""}`}
            >
              <span className="dot-inner">●</span>
              <span className="dot-label">3</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${loadingPercentage}%` }}
              ></div>
            </div>
            <p className="progress-text">
              {videosLoading}/{videosTotal} videos ready
            </p>
          </div>
        </div>

        {/* Loading Message */}
        <div className="loading-message">
          <h2>Preparing Your Feed</h2>
          <p>Generating personalized videos...</p>
        </div>

        {/* Animated Background Elements */}
        <div className="animated-bg">
          <div className="bg-orb orb-1"></div>
          <div className="bg-orb orb-2"></div>
          <div className="bg-orb orb-3"></div>
        </div>
      </div>
    </div>
  );
}
