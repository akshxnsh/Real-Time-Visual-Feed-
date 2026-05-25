"use client";

import TrendCard from "@/components/TrendCard";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./trends.module.css";

const FILTERS = [
  "All",
  "Tech",
  "Sports",
  "Entertainment",
  "Science",
  "Culture",
  "World",
];

export default function TrendsPage() {
  const router = useRouter();
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trends", { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data?.trends) ? data.trends : [];
      setTrends(list);
    } catch {
      setTrends([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trends.filter((t) => {
      const cat = (t.category || "world").toLowerCase();
      const matchCat =
        filter === "All" || cat === filter.toLowerCase();
      const matchQ =
        !q ||
        (t.topic || t.name || "").toLowerCase().includes(q) ||
        cat.includes(q);
      return matchCat && matchQ;
    });
  }, [trends, filter, query]);

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <div>
            <h1 className={styles.title}>What&apos;s Trending</h1>
            <p className={styles.sub}>
              AI-curated topics — refreshes every 15 minutes.
            </p>
          </div>
          <button
            type="button"
            className={styles.refresh}
            onClick={() => load()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? styles.filterOn : styles.filterOff}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <input
          type="search"
          className={styles.search}
          placeholder="Search trends…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search trends"
        />

        {loading && trends.length === 0 ? (
          <div className={styles.grid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={styles.skel} aria-hidden />
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((t) => (
              <TrendCard
                key={`${t.id ?? t.rank}-${t.topic ?? t.name}`}
                name={t.topic ?? t.name}
                category={t.category}
                tweetVolume={t.exploring ?? t.tweetVolume}
                rank={t.id ?? t.rank}
                onClick={() =>
                  router.push(
                    `/explore?topic=${encodeURIComponent(t.topic ?? t.name)}`
                  )
                }
              />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className={styles.empty}>No trends match filters.</p>
        )}
      </div>
    </div>
  );
}
