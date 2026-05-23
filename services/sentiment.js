/**
 * Sentiment & Preference Tracking System
 * 
 * This is the ONLY place in the codebase where sentiment profile logic lives.
 * It runs entirely in the background — the user never sees it, never configures it.
 * It silently watches how the user interacts with videos and builds a preference profile
 * that shapes every future video prompt.
 * 
 * In Phase 4, this profile moves from localStorage to PostgreSQL with cross-device sync.
 * Only this file needs to change — no other files affected.
 */

// Signal weights for engagement scoring
const SIGNAL_WEIGHTS = {
  watchedFull: 0.7,       // watched >90% of video
  watchedHalf: 0.3,       // watched 50-90%
  replayedOnce: 0.6,      // looped at least once
  replayedMultiple: 0.9,  // looped 3+ times
  scrolledEarly: -0.6,    // left before 20%
  scrolledMid: -0.2,      // left at 20-50%
  liked: 0.9,
  disliked: -1.0,         // strongest negative signal
  saved: 1.0,             // strongest positive signal
  shared: 0.95,
};

// Signal weights for news engagement (different from video)
const NEWS_SIGNAL_WEIGHTS = {
  readFull: 0.8,          // read >3 seconds on card
  readHalf: 0.4,          // read 1-3 seconds
  scrolledAwayEarly: -0.4, // left before 1 second
  liked: 0.85,
  disliked: -0.9,         // strong negative signal for news
  saved: 0.95,            // high weight for news save
  shared: 0.9,
  clickedLink: 1.0,       // strongest signal - actual engagement
};

// Exponential moving average learning rate
// Higher = adapts faster but less stable
// Lower = more stable but slower to adapt
// 0.15 is sweet spot for scroll feed
const LEARNING_RATE = 0.15;

/**
 * Default sentiment profile structure
 * All values are 0.0 to 1.0, default 0.5
 */
const defaultProfile = {
  // Topic affinity scores
  topics: {
    space: 0.5,
    history: 0.5,
    technology: 0.5,
    psychology: 0.5,
    science: 0.5,
    culture: 0.5,
    nature: 0.5,
    sports: 0.5,
    entertainment: 0.5,
    mystery: 0.5,
    finance: 0.5,
    health: 0.5,
  },

  // News category preferences
  newsCategories: {
    breaking: 0.5,
    business: 0.5,
    science: 0.5,
    sports: 0.5,
    entertainment: 0.5,
    health: 0.5,
    world: 0.5,
    tech: 0.5,
  },

  // Visual style preferences
  style: {
    dramatic: 0.5,        // high contrast, fast cuts
    calm: 0.5,            // slow, smooth, meditative
    educational: 0.5,     // clean, structured, informative
    cinematic: 0.5,       // movie-like, story-driven
    abstract: 0.5,        // artistic, conceptual
    realistic: 0.5,       // documentary style
  },

  // Content depth preference
  depth: {
    surface: 0.5,         // quick facts, broad strokes
    medium: 0.5,          // some detail, balanced
    deep: 0.5,            // complex, detailed, nuanced
  },

  // Pacing preference
  pacing: {
    fast: 0.5,            // quick cuts, high energy
    medium: 0.5,
    slow: 0.5,            // slow reveals, breathing room
  },

  // Mode preference
  mode: {
    learn: 0.5,
    entertain: 0.5,
    news: 0.5,            // news mode tracking
  },

  // Metadata
  totalVideosWatched: 0,
  totalNewsArticlesRead: 0,
  totalLikes: 0,
  totalDislikes: 0,
  totalSaves: 0,
  lastUpdated: null,
  profileConfidence: 0.0, // 0.0 to 1.0
  // Below 0.3 = too early to personalize heavily
  // Reaches 1.0 after 20 videos watched
};

/**
 * Load sentiment profile from localStorage
 * Returns default if not found or corrupted
 * @returns {object} - Complete sentiment profile
 */
export function loadProfile() {
  if (typeof window === "undefined") {
    return { ...defaultProfile };
  }

  try {
    const stored = localStorage.getItem("rtvf_sentiment_profile");
    return stored ? JSON.parse(stored) : { ...defaultProfile };
  } catch (e) {
    console.warn("Could not load sentiment profile, using default:", e);
    return { ...defaultProfile };
  }
}

/**
 * Save sentiment profile to localStorage
 * Handles errors silently to avoid blocking the feed
 * @param {object} profile - Complete sentiment profile
 */
export function saveProfile(profile) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem("rtvf_sentiment_profile", JSON.stringify(profile));
  } catch (e) {
    console.warn("Could not save sentiment profile:", e);
  }
}

/**
 * Calculate engagement score from signals
 * Returns 0.0 to 1.0
 * @param {object} signals - Watch/interaction signals
 * @returns {number} - Normalized engagement score
 */
export function calculateEngagementScore(signals) {
  let score = 0;

  // Passive watch signals
  if (signals.completionRate > 0.9) {
    score += SIGNAL_WEIGHTS.watchedFull;
  } else if (signals.completionRate > 0.5) {
    score += SIGNAL_WEIGHTS.watchedHalf;
  }

  // Replay signals
  if (signals.replayCount >= 3) {
    score += SIGNAL_WEIGHTS.replayedMultiple;
  } else if (signals.replayCount >= 1) {
    score += SIGNAL_WEIGHTS.replayedOnce;
  }

  // Scroll-away signals
  if (signals.scrolledAwayAt < 0.2) {
    score += SIGNAL_WEIGHTS.scrolledEarly;
  } else if (signals.scrolledAwayAt < 0.5) {
    score += SIGNAL_WEIGHTS.scrolledMid;
  }

  // Explicit interaction signals
  if (signals.liked) score += SIGNAL_WEIGHTS.liked;
  if (signals.disliked) score += SIGNAL_WEIGHTS.disliked;
  if (signals.saved) score += SIGNAL_WEIGHTS.saved;
  if (signals.shared) score += SIGNAL_WEIGHTS.shared;

  // Normalize to 0.0 - 1.0
  // Offset by 0.6 and scale to handle negative weights gracefully
  return Math.max(0, Math.min(1, (score + 0.6) / 1.6));
}

/**
 * Calculate engagement score from news article signals
 * Different weights than video since news engagement is measured differently
 * @param {object} signals - News interaction signals
 * @returns {number} - Normalized engagement score (0.0-1.0)
 */
export function calculateNewsEngagementScore(signals) {
  let score = 0;

  // Reading time signals
  if (signals.completionRate > 0.8) {
    score += NEWS_SIGNAL_WEIGHTS.readFull;
  } else if (signals.completionRate > 0.3) {
    score += NEWS_SIGNAL_WEIGHTS.readHalf;
  }

  // Scroll-away penalties
  if (signals.completionRate < 0.2) {
    score += NEWS_SIGNAL_WEIGHTS.scrolledAwayEarly;
  }

  // Explicit interaction signals
  if (signals.liked) score += NEWS_SIGNAL_WEIGHTS.liked;
  if (signals.disliked) score += NEWS_SIGNAL_WEIGHTS.disliked;
  if (signals.saved) score += NEWS_SIGNAL_WEIGHTS.saved;
  if (signals.shared) score += NEWS_SIGNAL_WEIGHTS.shared;

  // Clicked link is strongest signal
  if (signals.clickedLink) score += NEWS_SIGNAL_WEIGHTS.clickedLink;

  // Normalize to 0.0 - 1.0
  // Offset by 0.5 and scale appropriately
  return Math.max(0, Math.min(1, (score + 0.5) / 2.0));
}

/**
 * Exponential moving average function
 * Gives more weight to recent behavior
 * @param {number} current - Current profile value
 * @param {number} newValue - New signal value (0.0-1.0)
 * @param {number} rate - Learning rate (0.0-1.0)
 * @returns {number} - Updated value
 */
function ema(current, newValue, rate) {
  return current * (1 - rate) + newValue * rate;
}

/**
 * Update sentiment profile based on video or news interaction
 * Called after user leaves a video card or news article
 * @param {object} currentProfile - Current sentiment profile
 * @param {object} contentMeta - Metadata about the content shown
 * @param {object} signals - Watch/interaction signals
 * @returns {object} - Updated sentiment profile
 */
export function updateProfile(currentProfile, contentMeta, signals) {
  const profile = { ...currentProfile };

  // Handle news mode separately
  if (contentMeta.mode === "news") {
    const newsEngagementScore = calculateNewsEngagementScore(signals);

    // Update news category preferences
    if (contentMeta.category && profile.newsCategories[contentMeta.category] !== undefined) {
      profile.newsCategories[contentMeta.category] = ema(
        profile.newsCategories[contentMeta.category],
        newsEngagementScore,
        LEARNING_RATE
      );
    }

    // Update news mode preference
    profile.mode.news = ema(profile.mode.news, newsEngagementScore, LEARNING_RATE);

    // Update metadata
    profile.totalNewsArticlesRead++;
    if (signals.liked) profile.totalLikes++;
    if (signals.disliked) profile.totalDislikes = (profile.totalDislikes || 0) + 1;
    if (signals.saved) profile.totalSaves++;
    profile.lastUpdated = Date.now();

    // Include news articles in confidence calculation (count 2x as much as videos)
    const totalEngagements = profile.totalVideosWatched + (profile.totalNewsArticlesRead * 0.5);
    profile.profileConfidence = Math.min(1.0, totalEngagements / 20);

    return profile;
  }

  // Handle video mode (original logic)
  const engagementScore = calculateEngagementScore(signals);

  // Update topic affinities
  // contentMeta.categories is array like ['space', 'science']
  if (contentMeta.categories && Array.isArray(contentMeta.categories)) {
    contentMeta.categories.forEach((category) => {
      if (profile.topics[category] !== undefined) {
        profile.topics[category] = ema(
          profile.topics[category],
          engagementScore,
          LEARNING_RATE
        );
      }
    });
  }

  // Update style based on mode
  if (contentMeta.mode === "entertain") {
    profile.style.dramatic = ema(
      profile.style.dramatic,
      engagementScore,
      LEARNING_RATE
    );
    profile.style.cinematic = ema(
      profile.style.cinematic,
      engagementScore,
      LEARNING_RATE
    );
  }
  if (contentMeta.mode === "learn") {
    profile.style.educational = ema(
      profile.style.educational,
      engagementScore,
      LEARNING_RATE
    );
    profile.style.calm = ema(profile.style.calm, engagementScore, LEARNING_RATE);
  }

  // Update depth based on completion rate
  if (signals.completionRate > 0.8) {
    profile.depth.deep = ema(profile.depth.deep, engagementScore, LEARNING_RATE);
  } else if (signals.completionRate < 0.3) {
    profile.depth.surface = ema(
      profile.depth.surface,
      engagementScore,
      LEARNING_RATE
    );
  } else {
    profile.depth.medium = ema(
      profile.depth.medium,
      engagementScore,
      LEARNING_RATE
    );
  }

  // Update pacing based on how long they watched
  // Fast engagement → prefer fast pacing
  if (signals.completionRate > 0.8) {
    profile.pacing.fast = ema(
      profile.pacing.fast,
      engagementScore,
      LEARNING_RATE
    );
  } else {
    profile.pacing.slow = ema(
      profile.pacing.slow,
      engagementScore,
      LEARNING_RATE
    );
  }

  // Update mode preference
  const modeKey = contentMeta.mode === "entertain" ? "entertain" : "learn";
  profile.mode[modeKey] = ema(profile.mode[modeKey], engagementScore, LEARNING_RATE);

  // Update metadata
  profile.totalVideosWatched++;
  if (signals.liked) profile.totalLikes++;
  if (signals.disliked) profile.totalDislikes = (profile.totalDislikes || 0) + 1;
  if (signals.saved) profile.totalSaves++;
  profile.lastUpdated = Date.now();

  // Profile confidence reaches 1.0 after 20 videos watched
  profile.profileConfidence = Math.min(1.0, profile.totalVideosWatched / 20);

  return profile;
}

/**
 * Get top N topics by affinity score
 * @param {object} profile - Sentiment profile
 * @param {number} n - Number of topics to return
 * @returns {string[]} - Array of topic names
 */
export function getTopPreferences(profile, n = 3) {
  return Object.entries(profile.topics)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([topic]) => topic);
}

/**
 * Get dominant visual style
 * @param {object} profile - Sentiment profile
 * @returns {string} - Style name with highest score
 */
export function getDominantStyle(profile) {
  return Object.entries(profile.style).sort(([, a], [, b]) => b - a)[0][0];
}

/**
 * Get depth preference
 * @param {object} profile - Sentiment profile
 * @returns {string} - 'surface', 'medium', or 'deep'
 */
export function getDepthPreference(profile) {
  return Object.entries(profile.depth).sort(([, a], [, b]) => b - a)[0][0];
}

/**
 * Get pacing preference
 * @param {object} profile - Sentiment profile
 * @returns {string} - 'fast', 'medium', or 'slow'
 */
export function getPacingPreference(profile) {
  return Object.entries(profile.pacing).sort(([, a], [, b]) => b - a)[0][0];
}

/**
 * Seed an initial sentiment profile from onboarding selections.
 * Called once at the end of onboarding — gives the EMA algorithm
 * a head-start instead of starting completely neutral.
 *
 * @param {string[]} selectedTopics  - Topics picked on onboard step 1 (e.g. ["AI","Space"])
 * @param {string[]} selectedGenres  - Genres picked on onboard step 2 (e.g. ["Documentary","Thriller"])
 * @returns {object} - Seeded profile (caller is responsible for saving it)
 */
export function seedProfile(selectedTopics = [], selectedGenres = []) {
  // Deep clone defaultProfile — we never mutate the module-level default
  const profile = JSON.parse(JSON.stringify(defaultProfile));

  // ── Topic → profile.topics mapping ──────────────────────────────────────
  const TOPIC_MAP = {
    "AI":            ["technology"],
    "Technology":    ["technology"],
    "Programming":   ["technology"],
    "Science":       ["science"],
    "Mathematics":   ["science"],
    "Space":         ["space"],
    "Psychology":    ["psychology"],
    "Philosophy":    ["psychology"],
    "Cinema":        ["entertainment"],
    "Music":         ["entertainment", "culture"],
    "Art":           ["entertainment", "culture"],
    "Gaming":        ["entertainment"],
    "Sports":        ["sports"],
    "History":       ["history"],
    "Culture":       ["culture"],
    "Food":          ["culture"],
    "Travel":        ["culture"],
    "Finance":       ["finance"],
    "Health":        ["health"],
    "Nature":        ["nature"],
    "World News":    [], // handled separately below
  };

  selectedTopics.forEach((t) => {
    const keys = TOPIC_MAP[t];
    if (keys) {
      keys.forEach((k) => {
        if (profile.topics[k] !== undefined) {
          profile.topics[k] = Math.min(1.0, profile.topics[k] + 0.2);
        }
      });
    }
    // World News boosts news categories
    if (t === "World News") {
      profile.newsCategories.world   = Math.min(1.0, profile.newsCategories.world   + 0.2);
      profile.newsCategories.breaking = Math.min(1.0, profile.newsCategories.breaking + 0.15);
    }
  });

  // ── Genre → profile.style / pacing mapping ──────────────────────────────
  const GENRE_MAP = {
    "Documentary": { "style.realistic": 0.25, "style.calm": 0.15, "style.educational": 0.15 },
    "Educational": { "style.educational": 0.3,  "style.calm": 0.1 },
    "Thriller":    { "style.dramatic": 0.25,    "pacing.fast": 0.2 },
    "Comedy":      { "style.calm": 0.15,        "pacing.fast": 0.1 },
    "Action":      { "style.dramatic": 0.3,     "pacing.fast": 0.3 },
    "Mystery":     { "style.dramatic": 0.15,    "style.cinematic": 0.2 },
    "Sci-Fi":      { "style.cinematic": 0.25,   "style.abstract": 0.15 },
    "Nature":      { "style.calm": 0.25,        "style.realistic": 0.2 },
    "Horror":      { "style.dramatic": 0.3,     "style.cinematic": 0.15 },
    "Romance":     { "style.calm": 0.2,         "style.cinematic": 0.15 },
    "History":     { "style.educational": 0.2,  "style.cinematic": 0.15 },
    "Sports":      { "pacing.fast": 0.25,       "style.dramatic": 0.1 },
  };

  selectedGenres.forEach((g) => {
    const boosts = GENRE_MAP[g];
    if (!boosts) return;
    Object.entries(boosts).forEach(([path, delta]) => {
      const [section, key] = path.split(".");
      if (profile[section] && profile[section][key] !== undefined) {
        profile[section][key] = Math.min(1.0, profile[section][key] + delta);
      }
    });
  });

  profile.lastUpdated = Date.now();
  return profile;
}

/**
 * Map a free-form topic string to the relevant sentiment profile topic keys.
 * Used when a card is saved to immediately boost the matching affinities.
 * Returns an array of keys that exist in profile.topics.
 * @param {string} topicStr - Raw topic text (e.g. "Bollywood Movies", "Space Exploration")
 * @returns {string[]} - Matching keys from profile.topics
 */
export function topicToSentimentCategories(topicStr) {
  if (!topicStr || typeof topicStr !== "string") return [];
  const t = topicStr.toLowerCase();
  const hits = new Set();

  if (/\b(space|nasa|cosmos|galaxy|planet|orbit|rocket|astronaut|star|mars|moon|telescope)\b/.test(t)) hits.add("space");
  if (/\b(history|historical|ancient|empire|war|civilization|medieval|roman|greek|dynasty|revolution)\b/.test(t)) hits.add("history");
  if (/\b(tech|software|ai|artificial intelligence|machine learning|programming|code|developer|startup|app|digital|internet|chip|gpu|crypto|bitcoin)\b/.test(t)) hits.add("technology");
  if (/\b(psychology|mind|behavior|cognitive|mental|emotion|brain|bias|therapy|personality|consciousness)\b/.test(t)) hits.add("psychology");
  if (/\b(science|physics|chemistry|biology|quantum|research|experiment|discovery|genetics|molecule|atom)\b/.test(t)) hits.add("science");
  if (/\b(culture|art|music|film|cinema|bollywood|hollywood|novel|book|literature|food|cuisine|tradition|language|festival|dance|theatre)\b/.test(t)) hits.add("culture");
  if (/\b(nature|wildlife|animal|forest|ocean|climate|environment|plant|ecosystem|bird|insect|earth)\b/.test(t)) hits.add("nature");
  if (/\b(sport|cricket|football|soccer|nba|nfl|tennis|golf|olympic|athlete|championship|league|match)\b/.test(t)) hits.add("sports");
  if (/\b(entertainment|celebrity|movie|show|series|streaming|netflix|award|grammy|oscar|actor|actress|pop|concert)\b/.test(t)) hits.add("entertainment");
  if (/\b(mystery|unsolved|conspiracy|crime|detective|thriller|haunted|paranormal|strange|unexplained)\b/.test(t)) hits.add("mystery");
  if (/\b(finance|money|invest|stock|market|economy|trading|wealth|fund|bank|currency|tax|gdp)\b/.test(t)) hits.add("finance");
  if (/\b(health|medicine|medical|nutrition|fitness|diet|disease|mental health|yoga|workout|wellness|vaccine|doctor)\b/.test(t)) hits.add("health");

  return Array.from(hits);
}

/**
 * Reset sentiment profile to default
 * Used by debug panel only
 * @returns {object} - Fresh default profile
 */
export function resetProfile() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("rtvf_sentiment_profile");
  }
  return { ...defaultProfile };
}

/**
 * Get profile as debug object
 * Used only in development for Shift+P debug panel
 * @param {object} profile - Sentiment profile
 * @returns {object} - Formatted for display
 */
export function getProfileDebugInfo(profile) {
  return {
    confidence: profile.profileConfidence,
    videosWatched: profile.totalVideosWatched,
    likes: profile.totalLikes,
    saves: profile.totalSaves,
    topTopics: getTopPreferences(profile, 5),
    dominantStyle: getDominantStyle(profile),
    depthPreference: getDepthPreference(profile),
    pacingPreference: getPacingPreference(profile),
    lastUpdated: profile.lastUpdated
      ? new Date(profile.lastUpdated).toLocaleTimeString()
      : "never",
    allScores: {
      topics: profile.topics,
      styles: profile.style,
      depth: profile.depth,
      pacing: profile.pacing,
      mode: profile.mode,
    },
  };
}
