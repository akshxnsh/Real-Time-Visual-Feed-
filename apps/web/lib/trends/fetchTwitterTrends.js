import { categorizeTrendName } from "./categorize";
import { getMockTrends } from "./mockTrends";

/**
 * Normalize Twitter API v1.1 trends/place.json payload (WOEID 1 = worldwide).
 */
function normalizeTwitterV11Payload(json) {
  const first = Array.isArray(json) ? json[0] : null;
  const list = first?.trends;
  if (!Array.isArray(list)) return [];
  return list
    .filter((x) => x && typeof x.name === "string")
    .map((x, i) => {
      const name = x.name.replace(/^#/, "").trim() || x.name;
      const vol =
        typeof x.tweet_volume === "number" && x.tweet_volume >= 0
          ? x.tweet_volume
          : null;
      const category = categorizeTrendName(name);
      return {
        name,
        tweetVolume: vol,
        category,
        rank: i + 1,
      };
    });
}

/**
 * Fetch live trends — Bearer → RapidAPI → mock.
 * Never log secrets. Read-only display.
 */
export async function fetchTwitterTrendsOrMock() {
  const bearer = process.env.TWITTER_BEARER_TOKEN;
  if (bearer) {
    try {
      const res = await fetch(
        "https://api.twitter.com/1.1/trends/place.json?id=1",
        {
          headers: {
            Authorization: `Bearer ${bearer}`,
          },
          next: { revalidate: 900 },
        }
      );
      if (res.ok) {
        const json = await res.json();
        const trends = normalizeTwitterV11Payload(json);
        if (trends.length) return { trends, source: "twitter" };
      }
    } catch {
      /* fall through */
    }
  }

  const rapidKey = process.env.RAPIDAPI_KEY;
  const rapidHost = process.env.RAPIDAPI_TWITTER_HOST;
  if (rapidKey && rapidHost) {
    try {
      const res = await fetch(
        `https://${rapidHost}/trends?woeid=1`,
        {
          headers: {
            "X-RapidAPI-Key": rapidKey,
            "X-RapidAPI-Host": rapidHost,
          },
          next: { revalidate: 900 },
        }
      );
      if (res.ok) {
        const json = await res.json();
        const arr = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
            ? json
            : json?.trends;
        if (Array.isArray(arr) && arr.length) {
          const trends = arr.slice(0, 30).map((item, i) => {
            const name =
              typeof item === "string"
                ? item
                : item?.name || item?.topic || item?.query || "";
            const vol =
              typeof item?.tweet_volume === "number"
                ? item.tweet_volume
                : typeof item?.tweetVolume === "number"
                  ? item.tweetVolume
                  : null;
            return {
              name: String(name).replace(/^#/, ""),
              tweetVolume: vol,
              category: categorizeTrendName(String(name)),
              rank: i + 1,
            };
          });
          return { trends, source: "rapidapi" };
        }
      }
    } catch {
      /* fall through */
    }
  }

  return { trends: getMockTrends(), source: "mock" };
}
