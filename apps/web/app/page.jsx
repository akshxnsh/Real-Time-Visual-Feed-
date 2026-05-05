import HomePageClient from "@/components/HomePageClient";
import { getTrendsPayload } from "@/lib/trends/getTrendsPayload";

export default async function Page() {
  let initialTrends = [];

  try {
    const data = await getTrendsPayload();
    if (Array.isArray(data?.trends)) {
      initialTrends = data.trends.slice(0, 6);
    }
  } catch {
    initialTrends = [];
  }

  return <HomePageClient initialTrends={initialTrends} />;
}
