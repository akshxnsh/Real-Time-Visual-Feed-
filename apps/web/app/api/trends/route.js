import { NextResponse } from "next/server";
import { getTrendsPayload } from "../../../lib/trends/getTrendsPayload";
import { getMockTrends } from "../../../lib/trends/mockTrends";

export async function GET() {
  try {
    const payload = await getTrendsPayload();
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
