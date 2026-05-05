"use client";

import "./FeedCard.css";

export default function FeedCard({ text }) {
  return (
    <article className="card">
      <div className="card-content">
        <p>{text}</p>
      </div>
    </article>
  );
}
