// app/api/embed/route.ts
import { generateTextEmbedding } from "@/lib/embedding";
import { TaskType } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  try {
    const text = "My name is Mikias Wondim.";

    // Use the utility function
    const embeddingResult = await generateTextEmbedding(text, {
      model: "text-embedding-004",
      taskType: TaskType.RETRIEVAL_DOCUMENT,
    });

    return NextResponse.json(embeddingResult);
  } catch (error: any) {
    console.error("Error generating embedding:", error);
    return new Response(error?.message || "Something went wrong", {
      status: 500,
    });
  }
}
