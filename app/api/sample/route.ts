import { NextResponse } from "next/server";
import { loadSampleData } from "@/scripts/load-db";

export async function GET() {
  try {
    const scrapedData: any[] = [];

    console.log("Starting data scraping...");
    await loadSampleData();

    console.log("Scraping complete. Returning data.");
    return NextResponse.json({ success: true, data: scrapedData });
  } catch (error) {
    console.error("Error loading sample data:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
