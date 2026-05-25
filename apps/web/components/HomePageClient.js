"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import FeedCard from "../components/FeedCard";
import { signOut, useSession } from "next-auth/react";
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
  STORAGE_DISLIKED,
  STORAGE_SAVED,
  loadCardRecords,
  saveCardRecords,
  recordsMatch,
} from "../lib/rtvfStorage";
import { mapTrendRecordsToDisplay } from "../lib/trends/mapTrendRecords";
import {
  loadProfile,
  saveProfile,
  updateProfile,
  topicToSentimentCategories,
} from "../../../services/sentiment.js";
import "../app/page.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const ERROR_CARD_MARKER = "__FEED_ERROR__";
const BUFFER_WAIT = "__BUFFER_WAIT__";
const MODE_DIVIDER_MARKER = "__MODE_DIVIDER__";

const HERO_EXIT_MS = 550;

const QUICK_CHIPS_LEARN = [
  { label: "Psychology", value: "Psychology" },
  { label: "Science", value: "Science" },
  { label: "Ancient Rome", value: "Ancient Rome" },
  { label: "AI", value: "Artificial intelligence" },
  { label: "Space", value: "Space exploration" },
  { label: "Mathematics", value: "Mathematics" },
];

const QUICK_CHIPS_ENTERTAIN = [
  { label: "Cinema Secrets", value: "Classic cinema behind the scenes" },
  { label: "Conspiracies", value: "Famous conspiracy theories" },
  { label: "Dark History", value: "Dark history facts" },
  { label: "Mind Tricks", value: "Cognitive biases and illusions" },
  { label: "Celebrity Fails", value: "Celebrity scandal history" },
  { label: "Ocean Horrors", value: "Deep ocean mysteries" },
];

const QUICK_CHIPS_NEWS = [
  { label: "Breaking News", value: "breaking" },
  { label: "Business", value: "business" },
  { label: "Science", value: "science" },
  { label: "Health", value: "health" },
  { label: "Sports", value: "sports" },
  { label: "Entertainment", value: "entertainment" },
];

function isCardPayload(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    typeof item.text === "string" &&
    (item.mode === "learn" || item.mode === "entertain" || item.mode === "news")
  );
}

function isVideoCard(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    typeof item.videoUrl === "string" &&
    item.type === "video" &&
    (item.mode === "learn" || item.mode === "entertain" || item.mode === "news")
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
  "Updated in real time",
  "Adapts to what you like",
  "Contextual to your world",
  "Powered by distributed AI",
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
  const [dislikedRecords, setDislikedRecords] = useState([]);
  const [savedRecords, setSavedRecords] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isTrendingSession, setIsTrendingSession] = useState(false);
  const [selectedTrendingTopics, setSelectedTrendingTopics] = useState([]);
  const [headerPeeked, setHeaderPeeked] = useState(false);
  const headerHideTimerRef = useRef(null);

  // Full pool of 20 topics fetched once per session — never re-fetched
  const allTrendingPoolRef = useRef([]);
  // Window offset into the pool — advances every 10s to show a different set of 6
  const trendWindowOffsetRef = useRef(0);

  const [trendingDisplay, setTrendingDisplay] = useState(() => {
    if (!Array.isArray(initialTrends) || initialTrends.length === 0) return [];
    if (initialTrends[0]?.topic) {
      return initialTrends.slice(0, 6).map((t, idx) => {
        const exploring = t.exploring;
        const label =
          exploring >= 1_000_000
            ? `${(exploring / 1_000_000).toFixed(1)}M people exploring`
            : exploring >= 1000
            ? `${(exploring / 1000).toFixed(1)}k people exploring`
            : `${exploring} people exploring`;
        return {
          id: t.id || idx + 1,
          topic: t.topic,
          emoji: t.emoji || "🔥",
          category: t.category || "breaking",
          exploringLabel: label,
        };
      });
    }
    // Legacy Twitter/mock format: {name, tweetVolume, category, rank}
    return mapTrendRecordsToDisplay(initialTrends);
  });
  const [trendingFading, setTrendingFading] = useState(false);
  const [showTrendingUpdated, setShowTrendingUpdated] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(
    () => !Array.isArray(initialTrends) || initialTrends.length === 0
  );
  // User's detected country name (e.g. "India", "United States") — used to personalise trends
  const [userCountry, setUserCountry] = useState("the world");
  const userCountryRef = useRef("the world");

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
  const selectedTopicsRef = useRef(selectedTrendingTopics);
  const topicRotationIdxRef = useRef(0);
  const savedRecordsRef = useRef(savedRecords);
  // Tracks how many times each topic has been used this session — drives prompt variant
  const topicVariantRef = useRef(new Map());

  topicRef.current = topic;
  historyRef.current = history;
  modeRef.current = mode;
  uiPhaseRef.current = uiPhase;
  likedRecordsRef.current = likedRecords;
  isTrendingSessionRef.current = isTrendingSession;
  sentimentProfileRef.current = sentimentProfile;
  userCountryRef.current = userCountry;
  selectedTopicsRef.current = selectedTrendingTopics;
  savedRecordsRef.current = savedRecords;

  const { data: session } = useSession();

  const userGreeting = useMemo(() => {
    if (!session?.user?.name) return null;
    const hour = new Date().getHours();
    let timeGreeting;
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour < 18) timeGreeting = "Good afternoon";
    else timeGreeting = "Good evening";
    return `${timeGreeting}, ${session.user.name}!`;
  }, [session]);

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

  // Pre-warm pool: jobs submitted silently on app mount before the user picks a topic.
  // Each entry: { jobId: string, topic: string, mode: "learn" }
  const preWarmJobsRef = useRef([]);

  bufferRef.current = buffer;
  cardsRef.current = cards;

  useEffect(() => {
    try {
      setLikedRecords(loadCardRecords(STORAGE_LIKED));
      setDislikedRecords(loadCardRecords(STORAGE_DISLIKED));
      setSavedRecords(loadCardRecords(STORAGE_SAVED));
      setExploredList(loadExplored());
    } catch {
      setLikedRecords([]);
      setDislikedRecords([]);
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
    saveCardRecords(STORAGE_DISLIKED, dislikedRecords);
  }, [dislikedRecords]);

  useEffect(() => {
    saveCardRecords(STORAGE_SAVED, savedRecords);
  }, [savedRecords]);

  // Save sentiment profile whenever it changes
  useEffect(() => {
    saveProfile(sentimentProfile);
  }, [sentimentProfile]);

  // ─── Pre-warm ────────────────────────────────────────────────────────────────
  // Submit 6 video generation jobs the instant the app mounts — well before the user
  // picks a topic. The first 3 are consumed by the boot sequence as the opening cards.
  // The next 3 fill the buffer while the user is watching those first cards, so the
  // server is never idle from mount through the first 6 cards of the feed.
  // After those 6 pre-warm videos are exhausted, fresh topic-based generation takes over.
  const PRE_WARM_TOPICS = [
    { topic: "Human Brain",      prompt: "Create a fascinating short video about one mind-blowing fact about the human brain and how consciousness works",           caption: "How Your Brain Creates Reality"          },
    { topic: "Universe",         prompt: "Create a captivating short video about one incredible cosmic fact about our universe and its scale",                       caption: "The Universe's Best-Kept Secret"         },
    { topic: "Ancient History",  prompt: "Create an engaging short video about one surprising fact from ancient history that changed the world",                     caption: "Ancient History's Biggest Surprise"      },
    { topic: "Deep Ocean",       prompt: "Create a stunning short video about one extraordinary creature or phenomenon found in the deep ocean",                    caption: "Secrets of the Deep Ocean"               },
    { topic: "Physics",          prompt: "Create an exciting short video about one counterintuitive fact from quantum physics that challenges everyday reality",     caption: "Quantum Physics Will Blow Your Mind"     },
    { topic: "Mathematics",      prompt: "Create a captivating short video about one beautiful or surprising pattern hidden inside mathematics",                     caption: "The Hidden Beauty of Mathematics"        },
  ];

  useEffect(() => {
    const submitPreWarmJob = async (item) => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`${API_BASE}/api/video/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: item.topic,
            mode: "learn",
            prompt: item.prompt,
            timezone,
          }),
        });
        if (!res.ok) return;
        const { jobId } = await res.json();
        if (jobId) {
          preWarmJobsRef.current = [
            ...preWarmJobsRef.current,
            { jobId, topic: item.topic, mode: "learn", caption: item.caption || item.topic },
          ];
          console.log(`[pre-warm] job submitted: ${jobId} (${item.topic})`);
        }
      } catch {
        // best-effort — silently ignore pre-warm failures
      }
    };

    PRE_WARM_TOPICS.forEach(submitPreWarmJob);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect user's country once on mount via free IP geolocation (no API key required)
  useEffect(() => {
    const detect = async () => {
      try {
        const res = await fetch("https://ipapi.co/country_name/", { cache: "force-cache" });
        if (res.ok) {
          const name = (await res.text()).trim();
          // Only accept alphabetic country names to prevent injection
          if (name && /^[a-zA-Z\s\-']{2,60}$/.test(name)) {
            setUserCountry(name);
            userCountryRef.current = name;
          }
        }
      } catch {
        /* fall through — keeps default "the world" */
      }
    };
    detect();
  }, []);

  useEffect(() => {
    // Normalise a raw Groq topic object into the display shape
    const toDisplay = (t, idx) => {
      const exploring = t.exploring || 0;
      return {
        id: t.id || idx + 1,
        topic: t.topic,
        emoji: t.emoji || "🔥",
        category: t.category || "breaking",
        exploringLabel:
          exploring >= 1_000_000
            ? `${(exploring / 1_000_000).toFixed(1)}M people exploring`
            : exploring >= 1000
            ? `${(exploring / 1000).toFixed(1)}k people exploring`
            : `${exploring} people exploring`,
      };
    };

    // Fisher-Yates in-place shuffle
    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // Advance to a fresh random set of 6 from the pool
    const rotateWindow = (pool) => {
      if (pool.length === 0) return;
      // Pick 6 starting at current offset, then advance offset by 1 (not 6) for variety
      const offset = trendWindowOffsetRef.current;
      const slice = [];
      for (let i = 0; i < Math.min(6, pool.length); i++) {
        slice.push(pool[(offset + i) % pool.length]);
      }
      // Advance offset by a prime-ish step so we don't repeat the same window
      trendWindowOffsetRef.current = (offset + 3) % pool.length;
      setTrendingFading(true);
      window.setTimeout(() => {
        setTrendingDisplay(slice);
        setTrendingFading(false);
      }, 250);
    };

    const fetchOnce = async () => {
      try {
        const country = userCountryRef.current;
        const res = await fetch(
          `${API_BASE}/api/trending?country=${encodeURIComponent(country)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("trends failed");
        const data = await res.json();

        const raw = Array.isArray(data?.topics) ? data.topics : [];
        if (raw.length === 0) throw new Error("empty");

        // Build display pool, shuffle, store
        const pool = shuffle(raw.map(toDisplay));
        allTrendingPoolRef.current = pool;
        trendWindowOffsetRef.current = 0;

        // Show first window immediately
        setTrendingDisplay(pool.slice(0, 6));
        trendWindowOffsetRef.current = 6 % pool.length;
        setTrendingLoading(false);
        setTrendingFading(false);
      } catch {
        setTrendingDisplay((prev) => (prev.length > 0 ? prev : []));
        setTrendingLoading(false);
        setTrendingFading(false);
      }
    };

    fetchOnce();

    // Rotate visible chips every 10 seconds — no re-fetch, just slides the window
    const rotateId = window.setInterval(() => {
      const pool = allTrendingPoolRef.current;
      if (pool.length >= 6) rotateWindow(pool);
    }, 10_000);

    return () => window.clearInterval(rotateId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCountry]); // fetch once on mount + re-fetch if country resolves from IP detection

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
  // Returns next topic from selectedTopicsRef, cycling in order.
  // Falls back to topicRef.current when no topics are selected.
  const getNextRotatedTopic = useCallback(() => {
    const topics = selectedTopicsRef.current;
    if (!topics.length) return topicRef.current;
    const idx = topicRotationIdxRef.current % topics.length;
    topicRotationIdxRef.current += 1;
    return topics[idx];
  }, []);

  const streamSingleCard = useCallback(async (genId, topicOverride, variant = 0) => {
    const t = (topicOverride || topicRef.current).trim();
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
          variant,
        }),
      });

      if (!res.ok) return ERROR_CARD_MARKER;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let caption = null;

      while (true) {
        if (generationIdRef.current !== genId) {
          reader.cancel();
          return fullText ? { prompt: fullText, caption: caption || t } : ERROR_CARD_MARKER;
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
              if (data.done) {
                if (data.caption) caption = data.caption;
                return { prompt: fullText, caption: caption || t };
              }
            } catch (e) {
              // ignore parse errors for partial chunks
            }
          }
        }
      }

      return fullText ? { prompt: fullText, caption: caption || t } : ERROR_CARD_MARKER;
    } catch (error) {
      console.error("streamSingleCard error:", error);
      return ERROR_CARD_MARKER;
    }
  }, []);

  /**
   * Poll an already-submitted video job until it completes.
   * Used by the pre-warm drain and by generateVideo() after job submission.
   * @returns {Promise<{videoUrl: string, jobId: string}|"__VIDEO_ERROR__">}
   */
  const pollVideoJob = useCallback(async (genId, jobId) => {
    const maxAttempts = 300; // 10 minutes max (2s interval)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (generationIdRef.current !== genId) return "__VIDEO_ERROR__";
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
      try {
        const statusRes = await fetch(`${API_BASE}/api/video/status/${jobId}`);
        if (!statusRes.ok) continue;
        const { status, videoUrl } = await statusRes.json();
        console.log(`[poll] job ${jobId} → ${status}`);
        if (status === "complete" && videoUrl) return { videoUrl, jobId };
        if (status === "failed") return "__VIDEO_ERROR__";
      } catch {
        // retry on transient network error
      }
    }
    return "__VIDEO_ERROR__";
  }, []);

  /**
   * Generate a single video and poll until complete.
   * @param {number}      genId         - cancellation guard
   * @param {string}      topicOverride - topic for this card (falls back to topicRef)
   * @param {string|null} preBuiltPrompt - prompt from streamSingleCard(); null = backend builds its own
   * @returns {Promise<{videoUrl: string, jobId: string}|"__VIDEO_ERROR__">}
   */
  const generateVideo = useCallback(async (genId, topicOverride = null, preBuiltPrompt = null) => {
    const t = (topicOverride || topicRef.current).trim();
    if (!t) return "__VIDEO_ERROR__";

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const generateRes = await fetch(`${API_BASE}/api/video/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: t,
          mode: modeRef.current,
          sentimentProfile: sentimentProfileRef.current,
          timezone,
          ...(preBuiltPrompt ? { prompt: preBuiltPrompt } : {}),
        }),
      });

      if (!generateRes.ok) {
        console.error("Video generation request failed:", generateRes.status);
        return "__VIDEO_ERROR__";
      }

      const { jobId, countryCode } = await generateRes.json();
      console.log(`Video job created: ${jobId} (${countryCode})`);

      return pollVideoJob(genId, jobId);
    } catch (error) {
      console.error("Failed to generate video:", error);
      return "__VIDEO_ERROR__";
    }
  }, [pollVideoJob]);

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

  /**
   * Drain one pre-warm job from preWarmJobsRef.
   * Polls until complete and returns a ready video card object, or null if unavailable.
   * We use these first to give instant feed start — no generation wait for the user.
   */
  const drainPreWarm = useCallback(async (genId) => {
    const jobs = preWarmJobsRef.current;
    if (!jobs.length) return null;
    const [job, ...rest] = jobs;
    preWarmJobsRef.current = rest;
    const result = await pollVideoJob(genId, job.jobId);
    if (result === "__VIDEO_ERROR__") return null;
    return { videoUrl: result.videoUrl, jobId: result.jobId, topic: job.topic, mode: job.mode, caption: job.caption };
  }, [pollVideoJob]);

  // Target size of the ready-to-play pipeline (pre-warm pool + buffer combined).
  // Raising this means more videos are generated ahead of time and the server
  // is kept busy for longer after each refill cycle.
  const PIPELINE_TARGET = 6;

  const refillBuffer = useCallback(async () => {
    if (refillingRef.current) {
      pendingRefillRef.current = true;
      return;
    }
    pendingRefillRef.current = false;
    refillingRef.current = true;
    try {
      const m = modeRef.current;
      // Sequential loop — generates one video at a time and adds it to the buffer
      // the instant it completes, then immediately starts the next one.
      // This keeps the rtvf video server continuously busy (never idle between
      // completions) until the pipeline reaches PIPELINE_TARGET ready videos.
      while (bufferRef.current.length < PIPELINE_TARGET) {
        const genId = generationIdRef.current;
        let slot;

        // Try pre-warm pool first — these were submitted on mount and may already
        // be done, giving zero-wait buffer fills for the first PIPELINE_TARGET cards.
        const preWarmed = await drainPreWarm(genId);
        if (preWarmed) {
          slot = { ...preWarmed, mode: m, type: "video" };
        } else {
          // Pre-warm pool exhausted — generate a fresh topic-based video
          const nextTopic = getNextRotatedTopic();
          const variant = topicVariantRef.current.get(nextTopic) || 0;
          topicVariantRef.current.set(nextTopic, variant + 1);
          const cardData = await streamSingleCard(genId, nextTopic, variant);
          if (cardData === ERROR_CARD_MARKER) {
            slot = ERROR_CARD_MARKER;
          } else {
            const { prompt: promptText, caption } = cardData;
            const videoResult = await generateVideo(genId, nextTopic, promptText);
            slot =
              videoResult === "__VIDEO_ERROR__"
                ? ERROR_CARD_MARKER
                : { videoUrl: videoResult.videoUrl, jobId: videoResult.jobId, mode: m, topic: nextTopic, caption, type: "video" };
          }
        }

        // Add this video to the buffer the moment it's ready — don't wait for
        // the rest of the loop to finish so skeleton placeholders are replaced ASAP.
        const next = [...bufferRef.current, slot];
        bufferRef.current = next;
        setBuffer(next);
        tryReplaceSkeletonWithBuffer();
        // Loop back immediately — start the next generation without any pause.
      }
    } finally {
      refillingRef.current = false;
      if (pendingRefillRef.current) {
        pendingRefillRef.current = false;
        queueMicrotask(() => refillBufferRef.current());
      }
    }
  }, [drainPreWarm, getNextRotatedTopic, streamSingleCard, generateVideo, tryReplaceSkeletonWithBuffer]);

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

    // Safety valve: if boot takes longer than 3 minutes, force-dismiss the loading screen
    const safetyTimer = setTimeout(() => {
      if (bootstrappingRef.current) {
        setFeedInitialLoading(false);
        bootstrappingRef.current = false;
      }
    }, 180_000);

    (async () => {
      try {
      const genId = generationIdRef.current;
      const bootMode = modeRef.current;

      // Determine topics for the 3 initial card slots
      const bootTopics = [
        getNextRotatedTopic(),
        getNextRotatedTopic(),
        getNextRotatedTopic(),
      ];

      // ── Phase A: drain pre-warm pool + stream missing prompts ──────────────
      // For each slot: use a pre-warm job if available, otherwise stream a prompt.
      // Pre-warm slots already have a jobId ready (or nearly ready); prompt slots
      // still need a video job submitted.
      const slotPlan = await Promise.all(
        bootTopics.map(async (t, i) => {
          const preWarmed = await drainPreWarm(genId);
          if (preWarmed) {
            // Pre-warm video polled to completion — update the loading counter now
            videosLoadingRef.current++;
            setVideosLoadingCount(videosLoadingRef.current);
            return { kind: "prewarm", preWarmed };
          }
          // Need to stream a prompt, then submit a video job
          const promptText = await streamSingleCard(genId, t);
          return { kind: "fresh", topic: t, promptText };
        })
      );

      if (cancelled) {
        clearTimeout(safetyTimer);
        bootstrappingRef.current = false;
        setFeedInitialLoading(false);
        return;
      }

      // ── Phase B: generate/poll all video jobs in parallel ──────────────────
      const videoPromises = slotPlan.map(async (slot) => {
        if (slot.kind === "prewarm") {
          // Already polled to completion in drainPreWarm — result is ready
          if (!slot.preWarmed) return ERROR_CARD_MARKER;
          return {
            videoUrl: slot.preWarmed.videoUrl,
            jobId: slot.preWarmed.jobId,
            mode: bootMode,
            topic: slot.preWarmed.topic,
            type: "video",
          };
        }
        // Fresh slot: submit video job from the streamed prompt
        if (slot.promptText === ERROR_CARD_MARKER) {
          videosLoadingRef.current++;
          setVideosLoadingCount(videosLoadingRef.current);
          return ERROR_CARD_MARKER;
        }
        const videoResult = await generateVideo(genId, slot.topic, slot.promptText);
        videosLoadingRef.current++;
        setVideosLoadingCount(videosLoadingRef.current);
        if (videoResult === "__VIDEO_ERROR__") return ERROR_CARD_MARKER;
        return {
          videoUrl: videoResult.videoUrl,
          jobId: videoResult.jobId,
          mode: bootMode,
          topic: slot.topic,
          type: "video",
        };
      });

      const videoResults = await Promise.allSettled(videoPromises);

      if (cancelled) {
        clearTimeout(safetyTimer);
        bootstrappingRef.current = false;
        setFeedInitialLoading(false);
        return;
      }

      const items = videoResults.map((r) =>
        r.status === "fulfilled" ? r.value : ERROR_CARD_MARKER
      );

      setCards(items);
      setBuffer([]);
      bufferRef.current = [];
      clearTimeout(safetyTimer);
      setFeedInitialLoading(false);
      bootstrappingRef.current = false;
      queueMicrotask(() => refillBufferRef.current());
      } catch {
        clearTimeout(safetyTimer);
        setFeedInitialLoading(false);
        bootstrappingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [uiPhase, feedSession, getNextRotatedTopic, streamSingleCard, generateVideo, drainPreWarm]);

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
  // NOTE: dependency is cards[last] not cards.length so the observer re-attaches when
  // BUFFER_WAIT is replaced by a real card (same length, different last element).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards[cards.length - 1], uiPhase, feedInitialLoading]);

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
          disliked: signals.disliked || false,
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
    topicVariantRef.current = new Map();
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

  const handleTrendingTopicToggle = useCallback((topicName) => {
    setSelectedTrendingTopics((prev) =>
      prev.includes(topicName)
        ? prev.filter((t) => t !== topicName)
        : [...prev, topicName]
    );
  }, []);

  const handleStartFeed = useCallback(() => {
    if (selectedTopicsRef.current.length === 0) return;
    topicRotationIdxRef.current = 0;
    topicVariantRef.current = new Map();
    const firstTopic = selectedTopicsRef.current[0];
    topicRef.current = firstTopic;
    setTopic(firstTopic);
    setIsTrendingSession(true);
    const next = pushExplored(firstTopic, modeRef.current);
    setExploredList(next);
    transitionToFeedHero();
  }, [transitionToFeedHero]);

  const peekHeader = () => {
    clearTimeout(headerHideTimerRef.current);
    setHeaderPeeked(true);
  };
  const unpeekHeader = () => {
    headerHideTimerRef.current = setTimeout(() => setHeaderPeeked(false), 120);
  };

  const handleNewTopic = () => {
    generationIdRef.current++;
    topicVariantRef.current = new Map();
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
    setSelectedTrendingTopics([]);
    topicRotationIdxRef.current = 0;
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
    const t = topicRef.current;
    const m = modeRef.current;
    setCards((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = BUFFER_WAIT;
      return next;
    });
    const cardData = await streamSingleCard(genId, t);
    let newCard = ERROR_CARD_MARKER;
    if (cardData !== ERROR_CARD_MARKER) {
      const { prompt: promptText, caption } = cardData;
      const videoResult = await generateVideo(genId, t, promptText);
      if (videoResult !== "__VIDEO_ERROR__") {
        newCard = { videoUrl: videoResult.videoUrl, jobId: videoResult.jobId, mode: m, topic: t, caption, type: "video" };
      }
    }
    setCards((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = newCard;
      return next;
    });
    queueMicrotask(() => refillBufferRef.current());
  }, [streamSingleCard, generateVideo]);

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
    // Liking clears any dislike on the same card
    setDislikedRecords((prev) =>
      prev.filter((r) => !(r.topic === rec.topic && r.mode === rec.mode && r.text === rec.text))
    );
  }, []);

  const toggleDislike = useCallback((cardIndex, text, cardMode) => {
    const rec = {
      id: cardIndex,
      topic: topicRef.current,
      mode: cardMode,
      text,
      timestamp: Date.now(),
    };
    setDislikedRecords((prev) => {
      const match = (r) =>
        r.topic === rec.topic && r.mode === rec.mode && r.text === rec.text;
      if (prev.some(match)) return prev.filter((r) => !match(r));
      return [...prev, rec];
    });
    // Disliking clears any like on the same card
    setLikedRecords((prev) =>
      prev.filter((r) => !(r.topic === rec.topic && r.mode === rec.mode && r.text === rec.text))
    );
  }, []);

  const toggleSave = useCallback((cardIndex, text, cardMode, cardTopic) => {
    const effectiveTopic = cardTopic || topicRef.current;
    const rec = {
      id: cardIndex,
      topic: effectiveTopic,
      mode: cardMode,
      text,
      timestamp: Date.now(),
    };
    // Determine save vs unsave synchronously via ref — avoids React async closure issue
    const alreadySaved = savedRecordsRef.current.some(
      (r) => r.topic === rec.topic && r.mode === rec.mode && r.text === rec.text
    );
    setSavedRecords((prev) => {
      const match = (r) =>
        r.topic === rec.topic && r.mode === rec.mode && r.text === rec.text;
      if (prev.some(match)) return prev.filter((r) => !match(r));
      return [...prev, rec];
    });
    // On save (not unsave): boost sentiment and record topic in profile
    if (!alreadySaved) {
      setSentimentProfile((prev) => {
        const updated = updateProfile(
          prev,
          {
            topic: effectiveTopic,
            mode: cardMode,
            categories: topicToSentimentCategories(effectiveTopic),
          },
          {
            completionRate: 0.8,   // treat as well-watched
            replayCount: 0,
            saved: true,           // weight 1.0 — strongest positive signal
            liked: false,
            disliked: false,
            scrolledAwayAt: 0.8,
          }
        );
        // Append to explicit savedTopics list (deduplicated)
        const existingTopics = Array.isArray(updated.savedTopics) ? updated.savedTopics : [];
        if (!existingTopics.includes(effectiveTopic)) {
          updated.savedTopics = [...existingTopics, effectiveTopic];
        }
        saveProfile(updated);
        return updated;
      });
    } else {
      // On unsave: remove topic from profile if no other saves reference it
      setSentimentProfile((prev) => {
        const stillSaved = savedRecordsRef.current.some(
          (r) => r.topic === effectiveTopic && !(r.topic === rec.topic && r.mode === rec.mode && r.text === rec.text)
        );
        if (stillSaved) return prev;
        const updated = { ...prev, savedTopics: (Array.isArray(prev.savedTopics) ? prev.savedTopics : []).filter((t) => t !== effectiveTopic) };
        saveProfile(updated);
        return updated;
      });
    }
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

  const isTextDisliked = (text, cardMode) =>
    dislikedRecords.some(
      (r) => r.topic === topic && r.mode === cardMode && r.text === text
    );

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
      {/* Hover-to-reveal discover sidebar — floats over the left edge on all phases */}
      <LandingSidebarDock
        enabled
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
        onMetricsChange={onSidebarDockMetrics}
      >
        <DiscoverSidebar
          exploredEntries={exploredList}
          onPopularSelect={(t) => {
            topicRef.current = t;
            setTopic(t);
            if (uiPhaseRef.current === "landing") beginFeedFromLanding();
          }}
          onCategorySelect={(cat) => {
            topicRef.current = cat;
            setTopic(cat);
            if (uiPhaseRef.current === "landing") beginFeedFromLanding();
          }}
          onExploredSelect={(entry) => {
            topicRef.current = entry.topic;
            setTopic(entry.topic);
            setMode(entry.mode || "learn");
            if (uiPhaseRef.current === "landing") beginFeedFromLanding();
          }}
        />
      </LandingSidebarDock>

      {uiPhase === "landing" && (
        <header className="header header--landing">
          <div className="header-logo-wrap">
            <span className="blink-logo">
              <span className="blink-dots" aria-hidden>●●</span>
              <span className="blink-wordmark">Blink</span>
            </span>
          </div>
          <div className="header-right">
            {headerSavedBtn}
            <button
              className="header-account-btn"
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              style={{ marginLeft: 12 }}
              title="Logout or switch account"
            >
              Logout / Switch Account
            </button>
          </div>
        </header>
      )}

      {isFeedPhase && (
        <>
          {/* Thin hover-trigger zone always present at top of screen */}
          <div
            className="feed-header-trigger"
            onMouseEnter={peekHeader}
            onMouseLeave={unpeekHeader}
            aria-hidden="true"
          />
          <header
            className={`header header--compact${headerPeeked ? " header--peeked" : " header--feed-hidden"}`}
            onMouseEnter={peekHeader}
            onMouseLeave={unpeekHeader}
          >
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
            <ModeToggle mode={mode} onModeChange={handleModeChange} disabled={isFeedPhase || isLoading} />
            <button
              className="header-account-btn"
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              title="Logout or switch account"
            >
              Logout / Switch Account
            </button>
          </div>
        </header>
        </>
      )}

      <SavedDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        saved={savedRecords}
        onUnsave={handleUnsave}
      />

      {showHero && (
        <div
          className={`landing-shell ${heroExiting ? "landing-shell--exiting" : ""}`}
          aria-hidden={heroExiting}
        >
          <div className="landing-main">
            <div className="landing-greeting-screen">

              {/* Greeting */}
              <div className="landing-greeting">
                {userGreeting || "Welcome back!"}
              </div>
              <p className="landing-subtitle">
                What would you like to explore today?
              </p>

              {/* Trending topic multi-select grid */}
              <div className="landing-trending-label">
                Trending right now — pick what to watch
              </div>

              {trendingLoading ? (
                <div className="landing-trending-grid">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="trending-chip trending-chip--skeleton" aria-hidden />
                  ))}
                </div>
              ) : (
                <div className={`landing-trending-grid${trendingFading ? " landing-trending-grid--fading" : ""}`}>
                  {trendingDisplay.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`trending-chip${selectedTrendingTopics.includes(t.topic) ? " trending-chip--selected" : ""}`}
                      onClick={() => handleTrendingTopicToggle(t.topic)}
                    >
                      <span className="trending-chip__emoji" aria-hidden>{t.emoji}</span>
                      <span className="trending-chip__name">{t.topic}</span>
                      <span className="trending-chip__exploring">{t.exploringLabel}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Mode toggle */}
              <div className="landing-mode-row">
                <ModeToggle mode={mode} onModeChange={handleModeChange} disabled={heroExiting} />
              </div>

              {/* Start Feed CTA */}
              <button
                type="button"
                className={`start-feed-btn${selectedTrendingTopics.length > 0 ? " start-feed-btn--active" : ""}`}
                onClick={handleStartFeed}
                disabled={selectedTrendingTopics.length === 0 || heroExiting}
              >
                {heroExiting ? (
                  <span className="start-feed-btn__inner">
                    <span className="submit-spinner" aria-hidden />
                    Starting…
                  </span>
                ) : selectedTrendingTopics.length > 0 ? (
                  `Start Feed${selectedTrendingTopics.length > 1 ? ` · ${selectedTrendingTopics.length} topics` : ""}`
                ) : (
                  "Pick a topic to start"
                )}
              </button>

            </div>
          </div>
        </div>
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
                const { videoUrl, jobId, mode: videoMode, topic: videoTopic, caption: videoCaption } = item;
                const displayTopic = videoTopic || topic;
                return (
                  <div key={idx} className="card-wrapper">
                    <VideoCard
                      videoUrl={videoUrl}
                      topic={displayTopic}
                      caption={videoCaption || displayTopic}
                      mode={videoMode}
                      showTrendingBadge={isTrendingSessionRef.current}
                      isLiked={isTextLiked(videoUrl, videoMode)}
                      isDisliked={isTextDisliked(videoUrl, videoMode)}
                      isSaved={isTextSaved(videoUrl, videoMode)}
                      likeCount={likeCountForText(videoUrl, videoMode)}
                      onToggleLike={() => toggleLike(idx, videoUrl, videoMode)}
                      onToggleDislike={() => toggleDislike(idx, videoUrl, videoMode)}
                      onToggleSave={() => toggleSave(idx, videoUrl, videoMode, displayTopic)}
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
              if (isCardPayload(item)) {
                const { text: cardBody, mode: cardMode, topic: cardTopic } = item;
                const displayTopic = cardTopic || topic;
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
                      topic={displayTopic}
                      mode={cardMode}
                      scrollRootRef={feedRef}
                      showTrendingBadge={isTrendingSession}
                      isLiked={isTextLiked(cardBody, cardMode)}
                      isDisliked={isTextDisliked(cardBody, cardMode)}
                      isSaved={isTextSaved(cardBody, cardMode)}
                      likeCount={likeCountForText(cardBody, cardMode)}
                      onToggleLike={() => toggleLike(idx, cardBody, cardMode)}
                      onToggleDislike={() => toggleDislike(idx, cardBody, cardMode)}
                      onToggleSave={() => toggleSave(idx, cardBody, cardMode, displayTopic)}
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
