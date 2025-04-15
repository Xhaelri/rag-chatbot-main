// app/api/analyze-page/route.ts
import { NextResponse } from "next/server";
import { scrapePageWithScreenshot } from "@/lib/web-scrape";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function GET() {
  console.log("Analyzing page...");
  try {
    const url =
      "https://images.squarespace-cdn.com/content/v1/5759a0b362cd94a47d9c6242/1465572206126-WST5Y9FWA52HTMFR8BXM/image-asset.jpeg";

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Valid URL is required" },
        { status: 400 }
      );
    }

    // Scrape page with screenshot
    const { text, screenshot } = await scrapePageWithScreenshot(url);

    console.log(
      "Page scraped and screenshot taken",
      screenshot.length,
      "chars"
    );

    return NextResponse.json({
      data: screenshot.substring(0, 1000),
    });

    // Analyze screenshot with Google AI
    const visionModel = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    // 1. Load test image from filesystem
    // const imagePath = path.join(process.cwd(), "public", "test-image.jpg");
    // const imageData = await fs.readFile(imagePath);
    // const base64Image = imageData.toString("base64");

    const imagePart = {
      inlineData: {
        data: screenshot,
        mimeType: "image/png",
      },
    };

    const prompt = "Describe the image in a paragraph:";

    const result = await visionModel.generateContent([prompt, imagePart]);

    const imageAnalysis = result.response.text();

    return NextResponse.json({
      success: true,
      url,
      imageAnalysis,
      // textPreview: text.slice(0, 500) + (text.length > 500 ? "..." : ""),
    });
  } catch (error) {
    console.error("Page analysis error:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze page",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
