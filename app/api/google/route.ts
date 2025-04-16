import { generateId, Message, streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || "",
});

export const runtime = "edge";

const buildGoogleGenAIPrompt = (messages: Message[]): Message[] => {
  const safeMessages = Array.isArray(messages) ? messages : [];

  return [
    {
      id: generateId(),
      role: "system",
      content: `
      You are a helpful assistant that answers questions.
      `,
    },
    ...safeMessages.map((message) => ({
      id: generateId(),
      role: message.role,
      content: message.content,
    })),
  ];
};

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages)) {
      throw new Error("Messages must be an array");
    }

    const stream = await streamText({
      model: google("gemini-1.5-flash"),
      messages: buildGoogleGenAIPrompt(messages),
      temperature: 0.7,
    });

    return stream.toDataStreamResponse();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error generating text with Google Generative AI:", error);
    return new Response(error?.message || "Something went wrong", {
      status: 500,
    });
  }
}
