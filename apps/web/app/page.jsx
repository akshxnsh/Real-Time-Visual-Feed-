
import HomePageClient from "@/components/HomePageClient";
import { getTrendsPayload } from "@/lib/trends/getTrendsPayload";
import ProtectedPage from "@/components/ProtectedPage";

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

  return (
    <ProtectedPage>
      <HomePageClient initialTrends={initialTrends} />
    </ProtectedPage>
  );
}
