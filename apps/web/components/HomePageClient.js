"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import FeedCard from "../components/FeedCard";
import NewsCard from "../../../components/NewsCard.jsx";
import VideoCard from "../components/VideoCard";
import LoadingScreen from "../components/LoadingScreen";
import FeedErrorCard from "../components/FeedErrorCard";
import SkeletonCard from "../components/SkeletonCard";
import FeedBufferSkeleton from "../components/FeedBufferSkeleton";
import ScrollIndicator from "../components/ScrollIndicator";
import ModeToggle from "../components/ModeToggle";
import ModeDividerCard from "../components/ModeDividerCard";
import SavedDrawer from "../components/SavedDrawer";
import TrendingSection from "../components/TrendingSection";
import DiscoverSidebar from "../components/DiscoverSidebar";
import LandingSidebarDock from "../components/LandingSidebarDock";
import { SUGGESTION_TOPICS } from "../data/suggestionTopics";
import { loadExplored, pushExplored } from "../lib/exploredHistory";
import {
  STORAGE_LIKED,
  STORAGE_SAVED,
  loadCardRecords,
  saveCardRecords,
  recordsMatch,
} from "../lib/rtvlfStorage";
import { mapTrendRecordsToDisplay } from "../lib/trends/mapTrendRecords";
import {
  loadProfile,
  saveProfile,
  updateProfile,
} from "../../../services/sentiment.js";
import "../app/page.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const ERROR_CARD_MARKER = "__FEED_ERROR__";
const BUFFER_WAIT = "__BUFFER_WAIT__";
const MODE_DIVIDER_MARKER = "__MODE_DIVIDER__";

const HERO_EXIT_MS = 550;

const QUICK_CHIPS_LEARN = [
  { label: "🧠 Psychology", value: "Psychology" },
  { label: "🔬 Science", value: "Science" },
  { label: "🏛️ Ancient Rome", value: "Ancient Rome" },
  { label: "💻 AI", value: "Artificial intelligence" },
  { label: "🌌 Space", value: "Space exploration" },
  { label: "📐 Mathematics", value: "Mathematics" },
];

const QUICK_CHIPS_ENTERTAIN = [
  { label: "🎬 Cinema Secrets", value: "Classic cinema behind the scenes" },
  { label: "👽 Conspiracies", value: "Famous conspiracy theories" },
  { label: "💀 Dark History", value: "Dark history facts" },
  { label: "🤯 Mind Tricks", value: "Cognitive biases and illusions" },
  { label: "🎭 Celebrity Fails", value: "Celebrity scandal history" },
  { label: "🌊 Ocean Horrors", value: "Deep ocean mysteries" },
];

const QUICK_CHIPS_NEWS = [
  { label: "🔥 Breaking News", value: "breaking" },
  { label: "💼 Business", value: "business" },
  { label: "🔬 Science", value: "science" },
  { label: "🏥 Health", value: "health" },
  { label: "⚽ Sports", value: "sports" },
  { label: "🎬 Entertainment", value: "entertainment" },
];

function isCardPayload(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    typeof item.text === "string" &&
    (item.mode === "learn" || item.mode === "entertain")
  );
}

function isNewsArticle(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    typeof item.title === "string" &&
    typeof item.description === "string" &&
    item.mode === "news"
  );
}

function isVideoCard(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    typeof item.videoUrl === "string" &&
    item.type === "video" &&
    (item.mode === "learn" || item.mode === "entertain")
  );
}

function isModeDivider(item) {
  return (
    typeof item === "string" && item.startsWith(`${MODE_DIVIDER_MARKER}:`)
  );
}

function dividerTargetMode(item) {
  const prefix = `${MODE_DIVIDER_MARKER}:`;
  const m = item.startsWith(prefix) ? item.slice(prefix.length) : "learn";
  return m === "entertain" ? "entertain" : m === "news" ? "news" : "learn";
}

const CYCLING_TAGLINES = [
  "🚀 Updated in real time",
  "🧠 Adapts to what you like",
  "🌍 Contextual to your world",
  "⚡ Powered by distributed AI",
];

export default function HomePageClient({ initialTrends = [] }) {
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState("learn");
  const [cards, setCards] = useState([]);
  const [buffer, setBuffer] = useState([]);
  const [feedInitialLoading, setFeedInitialLoading] = useState(false);
  const [feedSession, setFeedSession] = useState(0);
  const [history, setHistory] = useState([]);
  const [uiPhase, setUiPhase] = useState("landing");
  const [scrollIndex, setScrollIndex] = useState(0);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [inputShake, setInputShake] = useState(false);
  const [scrollHintHidden, setScrollHintHidden] = useState(false);
  
  // Sentiment profile state — loaded from localStorage on mount
  const [sentimentProfile, setSentimentProfile] = useState(() => loadProfile());

  // Always start empty for SSR/hydration match; hydrate from storage in useEffect below.
  const [likedRecords, setLikedRecords] = useState([]);
  const [savedRecords, setSavedRecords] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isTrendingSession, setIsTrendingSession] = useState(false);

  const [trendingDisplay, setTrendingDisplay] = useState(() =>
    mapTrendRecordsToDisplay(initialTrends)
  );
  const [trendingFading, setTrendingFading] = useState(false);
  const [showTrendingUpdated, setShowTrendingUpdated] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(
    () => !Array.isArray(initialTrends) || initialTrends.length === 0
  );

  const [exploredList, setExploredList] = useState([]);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [taglineFade, setTaglineFade] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarDockMetrics, setSidebarDockMetrics] = useState({
    pinned: false,
    width: 300,
    isMobile: false,
  });

  // Track video loading progress for LoadingScreen
  const [videosLoadingCount, setVideosLoadingCount] = useState(0);
  const videosLoadingRef = useRef(0);

  const onSidebarDockMetrics = useCallback((m) => {
    setSidebarDockMetrics(m);
  }, []);

  const topicRef = useRef(topic);
  const historyRef = useRef(history);
  const modeRef = useRef(mode);
  const uiPhaseRef = useRef(uiPhase);
  const likedRecordsRef = useRef(likedRecords);
  const isTrendingSessionRef = useRef(isTrendingSession);
  const sentimentProfileRef = useRef(sentimentProfile);

  topicRef.current = topic;
  historyRef.current = history;
  modeRef.current = mode;
  uiPhaseRef.current = uiPhase;
  likedRecordsRef.current = likedRecords;
  isTrendingSessionRef.current = isTrendingSession;
  sentimentProfileRef.current = sentimentProfile;

  const feedRef = useRef(null);
  const searchWrapRef = useRef(null);
  const inputRef = useRef(null);
  const generationIdRef = useRef(0);
  const heroExitTimerRef = useRef(null);

  const bufferRef = useRef(buffer);
  const cardsRef = useRef(cards);
  const bootstrappingRef = useRef(false);
  const refillingRef = useRef(false);
  const pendingRefillRef = useRef(false);
  const ioRef = useRef(null);
  const refillBufferRef = useRef(() => {});

  bufferRef.current = buffer;
  cardsRef.current = cards;

  useEffect(() => {
    try {
      setLikedRecords(loadCardRecords(STORAGE_LIKED));
      setSavedRecords(loadCardRecords(STORAGE_SAVED));
      setExploredList(loadExplored());
    } catch {
      setLikedRecords([]);
      setSavedRecords([]);
      setExploredList([]);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTaglineFade(false);
      window.setTimeout(() => {
        setTaglineIndex((i) => (i + 1) % CYCLING_TAGLINES.length);
        setTaglineFade(true);
      }, 300);
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    saveCardRecords(STORAGE_LIKED, likedRecords);
  }, [likedRecords]);

  useEffect(() => {
    saveCardRecords(STORAGE_SAVED, savedRecords);
  }, [savedRecords]);

  // Save sentiment profile whenever it changes
  useEffect(() => {
    saveProfile(sentimentProfile);
  }, [sentimentProfile]);

  useEffect(() => {
    const fetchTrending = async (showFlash) => {
      try {
        setTrendingFading(true);
        await new Promise((r) => setTimeout(r, 120));
        const res = await fetch(`${API_BASE}/api/trending`, { cache: "no-store" });
        if (!res.ok) throw new Error("trends failed");
        const data = await res.json();
        
        // Map the Groq topics format to the display format
        const list = Array.isArray(data?.topics) ? data.topics : [];
        const displayList = list.slice(0, 6).map((t, idx) => {
          let exploring = t.exploring;
          if (exploring >= 1000) exploring = `${(exploring / 1000).toFixed(1)}k`;
          return {
            id: t.id || idx + 1,
            topic: t.topic,
            emoji: t.emoji || "🔥",
            category: t.category || "breaking",
            exploringLabel: `${exploring} people exploring`,
          };
        });
        
        setTrendingDisplay(displayList);
        setTrendingLoading(false);
        setTrendingFading(false);
        if (showFlash) {
          setShowTrendingUpdated(true);
          window.setTimeout(() => setShowTrendingUpdated(false), 2200);
        }
      } catch {
        setTrendingDisplay((prev) => (prev.length > 0 ? prev : []));
        setTrendingLoading(false);
        setTrendingFading(false);
      }
    };

    fetchTrending(false);
    const id = window.setInterval(() => fetchTrending(true), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const q = new URLSearchParams(window.location.search);
      const t = q.get("topic");
      if (t && uiPhaseRef.current === "landing") {
        topicRef.current = t;
        setTopic(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const filteredSuggestions = useMemo(() => {
    const q = topic.trim().toLowerCase();
    if (!q) return [];
    return SUGGESTION_TOPICS.filter((item) =>
      item.topic.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [topic]);

  const showSuggestions =
    suggestOpen && filteredSuggestions.length > 0 && uiPhase === "landing";

  const showQuickChips =
    uiPhase === "landing" && topic.trim() === "" && !showSuggestions;

  /**
   * Stream a text card from the backend
   */
  const streamSingleCard = useCallback(async (genId) => {
    const t = topicRef.current.trim();
    if (!t) return ERROR_CARD_MARKER;

    try {
      const res = await fetch(`${API_BASE}/api/feed/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: t,
          mode: modeRef.current,
          history: historyRef.current,
          sentimentProfile: sentimentProfileRef.current,
        }),
      });

      if (!res.ok) return ERROR_CARD_MARKER;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        if (generationIdRef.current !== genId) {
          reader.cancel();
          return fullText || ERROR_CARD_MARKER;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) return ERROR_CARD_MARKER;
              if (data.chunk) fullText += data.chunk;
              if (data.done) return fullText;
            } catch (e) {
              // ignore parse errors for partial chunks
            }
          }
        }
      }

      return fullText;
    } catch (error) {
      console.error("streamSingleCard error:", error);
      return ERROR_CARD_MARKER;
    }
  }, []);

  /**
   * Fetch breaking news articles from NewsAPI
   * Returns an array of news articles to populate the feed
   * @param {number} genId - Generation ID to detect cancellations
   * @returns {Promise<Array|"__NEWS_ERROR__">}
   */
  const fetchNewsArticles = useCallback(async (genId) => {
    const t = topicRef.current.trim();
    
    try {
      const endpoint = t && t !== "breaking" 
        ? `${API_BASE}/api/news/search?q=${encodeURIComponent(t)}`
        : `${API_BASE}/api/news/breaking?category=breaking`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        console.error("News fetch failed:", response.status);
        return ERROR_CARD_MARKER;
      }

      const data = await response.json();

      if (generationIdRef.current !== genId) {
        return [];
      }

      if (!data.articles || data.articles.length === 0) {
        console.warn("No news articles found");
        return ERROR_CARD_MARKER;
      }

      // Transform articles into card format
      const newsCards = data.articles.map((article) => ({
        ...article,
        mode: "news",
      }));

      return newsCards;
    } catch (error) {
      console.error("Failed to fetch news:", error);
      return ERROR_CARD_MARKER;
    }
  }, []);

  /**
   * Generate a single video and poll until complete
   * Sends timezone with every request
   * @param {number} genId - Generation ID to detect cancellations
   * @returns {Promise<{videoUrl: string, jobId: string}|"__VIDEO_ERROR__">}
   */
  const generateVideo = useCallback(async (genId) => {
    const t = topicRef.current.trim();
    if (!t) return "__VIDEO_ERROR__";

    try {
      // Detect timezone from browser
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Submit video generation job
      const generateRes = await fetch(`${API_BASE}/api/video/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: t,
          mode: modeRef.current,
          history: historyRef.current,
          sentimentProfile: sentimentProfileRef.current,
          timezone,
        }),
      });

      if (!generateRes.ok) {
        console.error("Video generation request failed:", generateRes.status);
        return "__VIDEO_ERROR__";
      }

      const { jobId, countryCode } = await generateRes.json();
      console.log(`Video job created: ${jobId} (${countryCode})`);

      // Poll for completion every 2 seconds
      const maxAttempts = 300; // 10 minutes max
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Check if generation was cancelled
        if (generationIdRef.current !== genId) {
          console.log("Video generation cancelled");
          return "__VIDEO_ERROR__";
        }

        // Wait 2 seconds before polling (except first attempt)
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        try {
          const statusRes = await fetch(`${API_BASE}/api/video/status/${jobId}`);
          
          if (!statusRes.ok) {
            console.error("Status check failed:", statusRes.status);
            continue;
          }

          const { status, videoUrl } = await statusRes.json();
          console.log(`Video job ${jobId} status: ${status}`);

          if (status === "complete" && videoUrl) {
            console.log(`Video ready: ${videoUrl}`);
            return { videoUrl, jobId };
          } else if (status === "failed") {
            console.error("Video generation failed");
            return "__VIDEO_ERROR__";
          }
          // Continue polling if pending or processing
        } catch (pollError) {
          console.error("Polling error:", pollError);
          // Retry on network error
        }
      }

      console.error("Video generation timeout");
      return "__VIDEO_ERROR__";
    } catch (error) {
      console.error("Failed to generate video:", error);
      return "__VIDEO_ERROR__";
    }
  }, []);

  const tryReplaceSkeletonWithBuffer = useCallback(() => {
    setCards((c) => {
      if (!c.length || c[c.length - 1] !== BUFFER_WAIT) return c;
      const b = bufferRef.current;
      if (!b.length) return c;
      const first = b[0];
      const rest = b.slice(1);
      bufferRef.current = rest;
      setBuffer(rest);
      return [...c.slice(0, -1), first];
    });
  }, []);

  const refillBuffer = useCallback(async () => {
    if (refillingRef.current) {
      pendingRefillRef.current = true;
      return;
    }
    pendingRefillRef.current = false;
    refillingRef.current = true;
    try {
      const m = modeRef.current;
      while (bufferRef.current.length < 3) {
        const genId = generationIdRef.current;
        let slot;

        if (m === "news") {
          // Generate visually animated news video explanation
          const result = await generateVideo(genId);
          slot = result === "__VIDEO_ERROR__" ? ERROR_CARD_MARKER : { ...result, mode: m };
        } else {
          // Generate text cards for learn/entertain modes
          const text = await streamSingleCard(genId);
          slot =
            text === ERROR_CARD_MARKER
              ? ERROR_CARD_MARKER
              : { text, mode: m };
        }

        setBuffer((prev) => {
          const next = [...prev, slot];
          bufferRef.current = next;
          return next;
        });
        tryReplaceSkeletonWithBuffer();
      }
    } finally {
      refillingRef.current = false;
      if (pendingRefillRef.current) {
        pendingRefillRef.current = false;
        queueMicrotask(() => refillBufferRef.current());
      }
    }
  }, [generateVideo, fetchNewsArticles, tryReplaceSkeletonWithBuffer]);

  useEffect(() => {
    refillBufferRef.current = refillBuffer;
  }, [refillBuffer]);

  useEffect(() => {
    if (uiPhase !== "feed") return;
    if (!topicRef.current?.trim()) return;
    if (cardsRef.current.length > 0) return;
    if (bootstrappingRef.current) return;

    let cancelled = false;
    bootstrappingRef.current = true;
    setFeedInitialLoading(true);
    videosLoadingRef.current = 0;
    setVideosLoadingCount(0);

    (async () => {
      const genId = generationIdRef.current;
      const bootMode = modeRef.current;
      
      let settled;
      if (bootMode === "news") {
        // For news mode, generate 3 initial video explainer cards
        const results = await Promise.allSettled([
          generateVideo(genId),
          generateVideo(genId),
          generateVideo(genId)
        ]);
        settled = results;
      } else {
        // For learn/entertain modes, generate 3 text cards
        // Use Promise.allSettled to get results as they complete
        const promises = [
          streamSingleCard(genId),
          streamSingleCard(genId),
          streamSingleCard(genId),
        ];
        
        settled = await Promise.allSettled(promises);
        
        // Update loading count as each completes
        settled.forEach((result, idx) => {
          if (result.status === "fulfilled" && result.value !== ERROR_CARD_MARKER) {
            videosLoadingRef.current++;
            setVideosLoadingCount(videosLoadingRef.current);
          }
        });
      }

      if (cancelled) {
        bootstrappingRef.current = false;
        setFeedInitialLoading(false);
        return;
      }

      const items = settled.map((r) =>
        r.status === "fulfilled" ? r.value : ERROR_CARD_MARKER
      );

      setCards(
        items.map((item) => {
          if (item === ERROR_CARD_MARKER) return item;
          if (bootMode === "news") {
            // Item is a news article object
            return item;
          } else {
            // Item is a string text from streamSingleCard
            return { text: item, mode: bootMode };
          }
        })
      );
      setBuffer([]);
      bufferRef.current = [];
      setFeedInitialLoading(false);
      bootstrappingRef.current = false;
      queueMicrotask(() => refillBufferRef.current());
    })();

    return () => {
      cancelled = true;
    };
  }, [uiPhase, feedSession, generateVideo, fetchNewsArticles]);

  useEffect(() => {
    if (uiPhase !== "feed") return;
    if (feedInitialLoading) return;
    const feed = feedRef.current;
    if (!feed) return;

    const wrappers = feed.querySelectorAll(".card-wrapper");
    const lastEl = wrappers[wrappers.length - 1];
    if (!lastEl) return;

    ioRef.current?.disconnect();

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.49) return;

        const root = feedRef.current;
        if (!root) return;
        const w = root.querySelectorAll(".card-wrapper");
        const currentLast = w[w.length - 1];
        if (entry.target !== currentLast) return;

        const prevSnap = cardsRef.current;
        if (!prevSnap.length) return;
        if (prevSnap[prevSnap.length - 1] === BUFFER_WAIT) return;

        io.unobserve(entry.target);

        setCards((prev) => {
          if (!prev.length) return prev;
          if (prev[prev.length - 1] === BUFFER_WAIT) return prev;

          const buf = bufferRef.current;
          if (buf.length > 0) {
            const nextCard = buf[0];
            const rest = buf.slice(1);
            bufferRef.current = rest;
            setBuffer(rest);
            return [...prev, nextCard];
          }
          return [...prev, BUFFER_WAIT];
        });

        queueMicrotask(() => refillBufferRef.current());
      },
      { root: feed, threshold: 0.5 }
    );

    io.observe(lastEl);
    ioRef.current = io;

    return () => {
      io.disconnect();
    };
  }, [cards.length, uiPhase, feedInitialLoading]);

  const triggerShake = () => {
    setInputShake(true);
    window.setTimeout(() => setInputShake(false), 400);
  };

  /**
   * Handle card leaving view — update sentiment profile with signals
   * Handles text cards, video cards, and news articles
   */
  const handleCardLeave = useCallback((cardMeta, signals, newsCategory) => {
    setSentimentProfile(prev => {
      // For news articles
      if (cardMeta.mode === "news" && newsCategory) {
        const updated = updateProfile(prev, {
          title: cardMeta.title,
          category: newsCategory,
          mode: "news",
        }, {
          completionRate: signals.completionRate || 0,
          liked: signals.liked || false,
          saved: signals.saved || false,
          shared: signals.shared || false,
          clickedLink: signals.clickedLink || false,
        });
        return updated;
      }

      // For text/video cards with categories array
      if (cardMeta.mode !== "news" && signals) {
        const updated = updateProfile(prev, {
          topic: cardMeta.topic,
          mode: cardMeta.mode,
          categories: cardMeta.categories || [],
        }, {
          completionRate: signals.watchedDuration !== undefined ? signals.watchedDuration : signals.completionRate || 0,
          replayCount: signals.replays || 0,
          liked: signals.liked || false,
          saved: signals.saved || false,
          shared: signals.shared || false,
          scrolledAwayAt: signals.scrolledAwayAt || 0.5,
        });
        return updated;
      }

      return prev;
    });
  }, []);

  const completeHeroExit = useCallback(() => {
    setUiPhase("feed");
  }, []);

  const transitionToFeedHero = useCallback(() => {
    setCards([]);
    setBuffer([]);
    bufferRef.current = [];
    setHistory([]);
    setScrollIndex(0);
    setScrollHintHidden(false);
    setUiPhase("hero_exit");
    if (heroExitTimerRef.current) clearTimeout(heroExitTimerRef.current);
    heroExitTimerRef.current = window.setTimeout(() => {
      completeHeroExit();
      heroExitTimerRef.current = null;
    }, HERO_EXIT_MS);
  }, [completeHeroExit]);

  const beginFeedFromLanding = useCallback(() => {
    if (uiPhaseRef.current !== "landing") return;
    const next = pushExplored(topicRef.current.trim(), modeRef.current);
    setExploredList(next);
    transitionToFeedHero();
  }, [transitionToFeedHero]);

  const startTopicAndFeed = useCallback(
    (t, m, fromTrending) => {
      if (uiPhaseRef.current !== "landing") return;
      // Preserve news mode, otherwise default to learn
      const mt = m === "news" ? "news" : (m === "entertain" ? "entertain" : "learn");
      topicRef.current = t;
      setTopic(t);
      setMode(mt);
      setIsTrendingSession(!!fromTrending);
      const next = pushExplored(t.trim(), mt);
      setExploredList(next);
      transitionToFeedHero();
    },
    [transitionToFeedHero]
  );

  const restartFeedFromHeader = useCallback(() => {
    if (!topicRef.current.trim()) {
      triggerShake();
      return;
    }
    const next = pushExplored(topicRef.current.trim(), modeRef.current);
    setExploredList(next);
    generationIdRef.current++;
    setFeedSession((s) => s + 1);
    setCards([]);
    setBuffer([]);
    bufferRef.current = [];
    setHistory([]);
    setScrollIndex(0);
    setScrollHintHidden(false);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      triggerShake();
      return;
    }
    if (uiPhase === "landing") {
      setIsTrendingSession(false);
      beginFeedFromLanding();
    } else if (uiPhase === "feed") {
      restartFeedFromHeader();
    }
  };

  const handleNewTopic = () => {
    generationIdRef.current++;
    setUiPhase("landing");
    setCards([]);
    setBuffer([]);
    bufferRef.current = [];
    setHistory([]);
    setScrollIndex(0);
    setTopic("");
    setScrollHintHidden(false);
    setSuggestOpen(false);
    setIsTrendingSession(false);
    setDrawerOpen(false);
    if (heroExitTimerRef.current) {
      clearTimeout(heroExitTimerRef.current);
      heroExitTimerRef.current = null;
    }
  };

  const applySuggestion = (value) => {
    topicRef.current = value;
    setTopic(value);
    setSuggestOpen(false);
    setHighlightIndex(-1);
  };

  const onChipPick = (value) => {
    startTopicAndFeed(value, modeRef.current, false);
  };

  const startFromTrendingTopic = (topicName) => {
    startTopicAndFeed(topicName, modeRef.current, true);
  };

  useEffect(() => {
    return () => {
      if (heroExitTimerRef.current) clearTimeout(heroExitTimerRef.current);
    };
  }, []);

  const retryLastCard = useCallback(async () => {
    generationIdRef.current++;
    const genId = generationIdRef.current;
    setCards((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = BUFFER_WAIT;
      return next;
    });
    const text = await streamSingleCard(genId);
    const m = modeRef.current;
    setCards((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] =
        text === ERROR_CARD_MARKER ? ERROR_CARD_MARKER : { text, mode: m };
      return next;
    });
    queueMicrotask(() => refillBufferRef.current());
  }, [streamSingleCard]);

  const toggleLike = useCallback((cardIndex, text, cardMode) => {
    const rec = {
      id: cardIndex,
      topic: topicRef.current,
      mode: cardMode,
      text,
      timestamp: Date.now(),
    };
    setLikedRecords((prev) => {
      const match = (r) =>
        r.topic === rec.topic && r.mode === rec.mode && r.text === rec.text;
      if (prev.some(match)) return prev.filter((r) => !match(r));
      return [...prev, rec];
    });
  }, []);

  const toggleSave = useCallback((cardIndex, text, cardMode) => {
    const rec = {
      id: cardIndex,
      topic: topicRef.current,
      mode: cardMode,
      text,
      timestamp: Date.now(),
    };
    setSavedRecords((prev) => {
      const match = (r) =>
        r.topic === rec.topic && r.mode === rec.mode && r.text === rec.text;
      if (prev.some(match)) return prev.filter((r) => !match(r));
      return [...prev, rec];
    });
  }, []);

  const handleUnsave = useCallback((rec) => {
    setSavedRecords((prev) => prev.filter((r) => !recordsMatch(r, rec)));
  }, []);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;

    const feed = feedRef.current;
    const cardHeight = feed.clientHeight || 1;
    const scrollPosition = feed.scrollTop;
    const currentIndex = Math.round(scrollPosition / cardHeight);
    setScrollIndex(currentIndex);

    if (scrollPosition > 24 || currentIndex > 0) {
      setScrollHintHidden(true);
    }
  }, []);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    feed.addEventListener("scroll", handleScroll, { passive: true });
    return () => feed.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (filteredSuggestions.length === 0) {
      setHighlightIndex(-1);
      return;
    }
    setHighlightIndex((i) =>
      i < 0 ? 0 : Math.min(i, filteredSuggestions.length - 1)
    );
  }, [filteredSuggestions]);

  const onSearchKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) =>
        Math.min(i + 1, filteredSuggestions.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      const pick = filteredSuggestions[highlightIndex];
      applySuggestion(pick.topic);
      setIsTrendingSession(false);
      beginFeedFromLanding();
    }
  };

  const landingSubmitFromSuggestion = () => {
    if (!topic.trim()) {
      triggerShake();
      return;
    }
    setIsTrendingSession(false);
    beginFeedFromLanding();
  };

  const likeCountForText = (text, cardMode) =>
    likedRecords.filter(
      (r) =>
        r.topic === topic && r.mode === cardMode && r.text === text
    ).length;

  const isTextLiked = (text, cardMode) => likeCountForText(text, cardMode) > 0;

  const isTextSaved = (text, cardMode) =>
    savedRecords.some(
      (r) =>
        r.topic === topic && r.mode === cardMode && r.text === text
    );

  const quickChips = useMemo(
    () => {
      if (mode === "entertain") return QUICK_CHIPS_ENTERTAIN;
      if (mode === "news") return QUICK_CHIPS_NEWS;
      return QUICK_CHIPS_LEARN;
    },
    [mode]
  );

  const handleModeChange = useCallback((nextMode) => {
    const prevMode = modeRef.current;
    setMode(nextMode);

    // Auto-start news feed without topic input
    if (nextMode === "news" && uiPhaseRef.current === "landing") {
      topicRef.current = "breaking";
      setTopic("breaking");
      setIsTrendingSession(false);
      const next = pushExplored("breaking", nextMode);
      setExploredList(next);
      transitionToFeedHero();
      return;
    }

    // Mode divider for feed phase
    if (
      uiPhaseRef.current === "feed" &&
      prevMode !== nextMode &&
      cardsRef.current.length > 0
    ) {
      setCards((c) => [...c, `${MODE_DIVIDER_MARKER}:${nextMode}`]);
    }
  }, [transitionToFeedHero]);

  const isFeedPhase = uiPhase === "feed";
  const showHero = uiPhase === "landing" || uiPhase === "hero_exit";
  const heroExiting = uiPhase === "hero_exit";

  const sidebarPinOffset =
    showHero &&
    sidebarDockMetrics.pinned &&
    !sidebarDockMetrics.isMobile
      ? sidebarDockMetrics.width
      : 0;

  const layoutSidebarShiftStyle = { marginLeft: sidebarPinOffset };
  const firstCardLoading = feedInitialLoading;
  const isLoading = feedInitialLoading;

  const scrollTrendingIntoView = useCallback(() => {
    document
      .getElementById("trending-section")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const headerSavedBtn = (
    <button
      type="button"
      className="header-saved-btn"
      onClick={() => setDrawerOpen(true)}
      aria-label="Open saved cards"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  return (
    <div className="container">
      {uiPhase === "landing" && (
        <header
          className="header header--landing"
          style={layoutSidebarShiftStyle}
        >
          <button
            type="button"
            className="header-hamburger"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open discover menu"
          >
            ☰
          </button>
          <div className="header-logo-wrap">
            <img
              src="/logo.png"
              alt="RTVLF"
              width={140}
              height={34}
              className="logo"
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const next = e.currentTarget.nextElementSibling;
                if (next instanceof HTMLElement) next.style.display = "block";
              }}
            />
            <span className="logo-fallback-inline">RTVLF</span>
          </div>
          <div className="header-right">
            {headerSavedBtn}
            <ModeToggle mode={mode} onModeChange={handleModeChange} disabled={isLoading} />
          </div>
        </header>
      )}

      {isFeedPhase && (
        <header className="header header--compact">
          <button
            type="button"
            className="new-topic-btn"
            onClick={handleNewTopic}
          >
            New Topic
          </button>
          <form onSubmit={handleSubmit} className="input-group input-group--compact">
            <div
              ref={searchWrapRef}
              className={`search-field-wrap ${inputShake ? "search-field-wrap--shake" : ""}`}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="What are you curious about?"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setSuggestOpen(false);
                  setHighlightIndex(-1);
                }}
                className="topic-input"
                disabled={firstCardLoading}
              />
            </div>
            <button
              type="submit"
              className={`submit-btn ${firstCardLoading ? "submit-btn--loading" : ""}`}
              disabled={firstCardLoading}
            >
              {firstCardLoading ? (
                <span className="submit-btn-inner">
                  <span className="submit-spinner" aria-hidden />
                  Generating...
                </span>
              ) : (
                "Start"
              )}
            </button>
          </form>
          <div className="header-right header-right--compact">
            {headerSavedBtn}
            <ModeToggle mode={mode} onModeChange={handleModeChange} disabled={isLoading} />
          </div>
        </header>
      )}

      <SavedDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        saved={savedRecords}
        onUnsave={handleUnsave}
      />

      {showHero && (
        <>
          <LandingSidebarDock
            enabled={showHero}
            mobileOpen={mobileSidebarOpen}
            onMobileOpenChange={setMobileSidebarOpen}
            onMetricsChange={onSidebarDockMetrics}
          >
            <DiscoverSidebar
              exploredEntries={exploredList}
              onPopularSelect={(name) =>
                startTopicAndFeed(name, modeRef.current, false)
              }
              onCategorySelect={(cat) =>
                startTopicAndFeed(cat, modeRef.current, false)
              }
              onExploredSelect={(entry) =>
                startTopicAndFeed(entry.topic, entry.mode, false)
              }
            />
          </LandingSidebarDock>
          <div
            className={`landing-shell ${heroExiting ? "landing-shell--exiting" : ""}`}
            aria-hidden={heroExiting}
            style={layoutSidebarShiftStyle}
          >
          <div className="landing-main">
            <div className="landing-main-inner">
              <div className="hero-heading-wrap">
                <h1 className="hero-line hero-line--1">
                  What are you{" "}
                  <span
                    className={
                      mode === "entertain"
                        ? "hero-accent-word hero-accent-word--entertain"
                        : "hero-accent-word hero-accent-word--learn"
                    }
                  >
                    curious
                  </span>{" "}
                  about?
                </h1>
                <p className="hero-line hero-line--2">
                  {mode === "entertain"
                    ? "Mind-blowing facts. One scroll at a time."
                    : "Learn or get entertained — one scroll at a time."}
                </p>
                <p
                  className="hero-tagline hero-tagline--cycle"
                  style={{
                    opacity: taglineFade ? 1 : 0,
                    transition: "opacity 0.3s ease",
                  }}
                >
                  {CYCLING_TAGLINES[taglineIndex]}
                </p>
              </div>

            <div className="hero-line hero-line--3 hero-search-block">
              <form
                className="hero-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  landingSubmitFromSuggestion();
                }}
              >
                <div
                  ref={searchWrapRef}
                  className={`search-field-wrap search-field-wrap--has-search-icon ${inputShake ? "search-field-wrap--shake" : ""}`}
                >
                  <span className="search-field-wrap__search-icon" aria-hidden>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#555570"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="What are you curious about?"
                    value={topic}
                    onChange={(e) => {
                      setTopic(e.target.value);
                      setSuggestOpen(true);
                      setHighlightIndex(-1);
                    }}
                    onFocus={() => setSuggestOpen(true)}
                    onBlur={() =>
                      window.setTimeout(() => setSuggestOpen(false), 120)
                    }
                    onKeyDown={onSearchKeyDown}
                    className="topic-input topic-input--hero"
                    autoComplete="off"
                    disabled={heroExiting && isLoading}
                  />
                  {showSuggestions && (
                    <div className="suggestion-dropdown" role="listbox">
                      {filteredSuggestions.map((item, idx) => (
                        <button
                          key={item.topic}
                          type="button"
                          role="option"
                          aria-selected={highlightIndex === idx}
                          className={`suggestion-row ${highlightIndex === idx ? "suggestion-row--active" : ""}`}
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => {
                            applySuggestion(item.topic);
                            setIsTrendingSession(false);
                            beginFeedFromLanding();
                          }}
                        >
                          <span className="suggestion-icon" aria-hidden>
                            {item.icon}
                          </span>
                          <span>{item.topic}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className={`submit-btn ${firstCardLoading && heroExiting ? "submit-btn--loading" : ""}`}
                  disabled={(heroExiting && isLoading) || firstCardLoading}
                >
                  {firstCardLoading && heroExiting ? (
                    <span className="submit-btn-inner">
                      <span className="submit-spinner" aria-hidden />
                      Generating...
                    </span>
                  ) : (
                    "Start"
                  )}
                </button>
              </form>
            </div>

            {showQuickChips && (
              <div className="hero-line hero-line--4 hero-chips" aria-label="Quick topics">
                {quickChips.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className="topic-chip"
                    onClick={() => onChipPick(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {showQuickChips && (
              <>
                <div className="hero-line hero-line--5 trending-wrap">
                  <TrendingSection
                    items={trendingDisplay}
                    onSelectTopic={startFromTrendingTopic}
                    showUpdatedFlash={showTrendingUpdated}
                    fading={trendingFading}
                    seeAllHref="/trends"
                    isLoading={trendingLoading}
                    sectionLabel={
                      mode === "entertain"
                        ? "🔥 Blowing Up Right Now"
                        : "🔥 Trending Now"
                    }
                  />
                </div>
                <section
                  className="landing-how-it-works hero-line hero-line--6"
                  aria-label="How it works"
                >
                  <div className="landing-how-it-works__grid">
                    <div className="landing-how-it-works__col">
                      <span className="landing-how-it-works__emoji" aria-hidden>
                        ⚡
                      </span>
                      <h3 className="landing-how-it-works__title">
                        Real-time generation
                      </h3>
                      <p className="landing-how-it-works__desc">
                        Every card is created fresh, just for you
                      </p>
                    </div>
                    <div className="landing-how-it-works__col">
                      <span className="landing-how-it-works__emoji" aria-hidden>
                        🧠
                      </span>
                      <h3 className="landing-how-it-works__title">
                        Learns your taste
                      </h3>
                      <p className="landing-how-it-works__desc">
                        The more you scroll, the smarter it gets
                      </p>
                    </div>
                    <div className="landing-how-it-works__col">
                      <span className="landing-how-it-works__emoji" aria-hidden>
                        🌍
                      </span>
                      <h3 className="landing-how-it-works__title">
                        Context-aware
                      </h3>
                      <p className="landing-how-it-works__desc">
                        Content shaped by what&apos;s happening in your world
                      </p>
                    </div>
                  </div>
                </section>
              </>
            )}
            </div>
          </div>
          </div>
        </>
      )}

      {(uiPhase === "hero_exit" || uiPhase === "feed") && (
        <>
          {/* LoadingScreen while initial videos generate */}
          <LoadingScreen
            visible={feedInitialLoading && modeRef.current !== "news"}
            videosLoading={videosLoadingCount}
            videosTotal={3}
            onDismiss={() => setFeedInitialLoading(false)}
          />

          <div
            className={`feed ${isFeedPhase ? "feed--with-compact-header" : "feed--under-hero"}`}
            ref={feedRef}
          >
            {feedInitialLoading && isFeedPhase && (
              <div className="feed-initial-loading" role="status" aria-live="polite">
                Generating your feed...
              </div>
            )}
            {cards.map((item, idx) => {
              const cardOrdinal = cards
                .slice(0, idx + 1)
                .filter((c) => isCardPayload(c) && String(c.text || "").trim())
                .length;

              if (item === BUFFER_WAIT) {
                return (
                  <div key={idx} className="card-wrapper">
                    <FeedBufferSkeleton />
                  </div>
                );
              }
              if (item === ERROR_CARD_MARKER) {
                return (
                  <div key={idx} className="card-wrapper">
                    <FeedErrorCard onRetry={retryLastCard} />
                  </div>
                );
              }
              if (isModeDivider(item)) {
                return (
                  <div key={idx} className="card-wrapper card-wrapper--mode-divider">
                    <ModeDividerCard mode={dividerTargetMode(item)} />
                  </div>
                );
              }
              if (isVideoCard(item)) {
                const { videoUrl, jobId, mode: videoMode } = item;
                const videoOrdinal = cards
                  .slice(0, idx + 1)
                  .filter((c) => isVideoCard(c))
                  .length;

                return (
                  <div key={idx} className="card-wrapper">
                    <VideoCard
                      videoUrl={videoUrl}
                      topic={topicRef.current}
                      mode={videoMode}
                      cardNumber={videoOrdinal}
                      totalCards={3}
                      showTrendingBadge={isTrendingSessionRef.current}
                      isLiked={false}
                      isSaved={false}
                      likeCount={0}
                      onToggleLike={() => {}}
                      onToggleSave={() => {}}
                      onCardLeave={handleCardLeave}
                      scrollRootRef={feedRef}
                    />
                    {idx === 0 && (
                      <ScrollIndicator
                        visible={scrollIndex === 0 && cards.length > 1}
                        faded={scrollHintHidden}
                      />
                    )}
                  </div>
                );
              }
              if (isNewsArticle(item)) {
                return (
                  <div key={idx} className="card-wrapper">
                    <NewsCard
                      title={item.title}
                      description={item.description}
                      source={item.source}
                      image={item.image}
                      timestamp={item.timestamp}
                      category={item.category}
                      url={item.url}
                      onCardLeave={handleCardLeave}
                      scrollRootRef={scrollRootRef}
                    />
                  </div>
                );
              }
              if (isCardPayload(item)) {
                const { text: cardBody, mode: cardMode } = item;
                const hasText = Boolean(String(cardBody || "").trim());
                if (!hasText) {
                  return (
                    <div key={idx} className="card-wrapper">
                      <SkeletonCard />
                    </div>
                  );
                }
                return (
                  <div key={idx} className="card-wrapper">
                    <FeedCard
                      text={cardBody}
                      cardNumber={cardOrdinal}
                      topic={topic}
                      mode={cardMode}
                      scrollRootRef={feedRef}
                      showTrendingBadge={isTrendingSession}
                      isLiked={isTextLiked(cardBody, cardMode)}
                      isSaved={isTextSaved(cardBody, cardMode)}
                      likeCount={likeCountForText(cardBody, cardMode)}
                      onToggleLike={() => toggleLike(idx, cardBody, cardMode)}
                      onToggleSave={() => toggleSave(idx, cardBody, cardMode)}
                      onCardLeave={handleCardLeave}
                    />
                    {idx === 0 && (
                      <ScrollIndicator
                        visible={scrollIndex === 0 && cards.length > 1}
                        faded={scrollHintHidden}
                      />
                    )}
                  </div>
                );
              }
              return (
                <div key={idx} className="card-wrapper">
                  <SkeletonCard />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
