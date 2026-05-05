import { unstable_cache } from "next/cache";
import { fetchTwitterTrendsOrMock } from "./fetchTwitterTrends";

async function loadTrendsUncached() {
  try {
    return await fetchTwitterTrendsOrMock();
  } catch {
    const { getMockTrends } = await import("./mockTrends");
    return { trends: getMockTrends(), source: "mock" };
  }
}

/** Cached 15 minutes — shared by Route Handler + Server Components */
export const getTrendsPayload = unstable_cache(
  async () => loadTrendsUncached(),
  ["x-trends-v1"],
  { revalidate: 900 }
);
