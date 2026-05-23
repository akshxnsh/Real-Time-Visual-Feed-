import { NextResponse } from "next/server";
import { getTrendsPayload } from "../../../lib/trends/getTrendsPayload";
import { getMockTrends } from "../../../lib/trends/mockTrends";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawCountry = searchParams.get("country") || "the world";
    // Sanitize — letters, spaces, hyphens, apostrophes only
    const country = rawCountry.replace(/[^a-zA-Z\s\-']/g, "").trim().slice(0, 60) || "the world";

    const payload = await getTrendsPayload(country);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json(
      { trends: getMockTrends(), source: "mock" },
      { status: 200 }
    );
  }
}
