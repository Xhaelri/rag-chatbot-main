import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

type EmbeddingModel = "embedding-001" | "text-embedding-004";

interface EmbeddingOptions {
  model?: EmbeddingModel;
  taskType?: TaskType;
  title?: string;
}

interface EmbeddingResult {
  text: string;
  embedding: number[];
  dimensions: number;
  model: string;
  taskType?: string;
}

/**
 * Generates text embeddings using Google's Generative AI
 * @param text Input text to embed
 * @param options Configuration options
 * @returns Promise with embedding result
 */
export async function generateTextEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<EmbeddingResult> {
  try {
    // Validate input
    if (!text || typeof text !== "string") {
      throw new Error("Text must be a non-empty string");
    }

    const {
      model = "text-embedding-004",
      taskType = TaskType.RETRIEVAL_DOCUMENT,
      title = "",
    } = options;

    // Initialize model (dimensions are fixed per model)
    const generativeModel = genAI.getGenerativeModel({ model });

    // Generate embedding
    const result = await generativeModel.embedContent({
      content: {
        role: "user",
        parts: [{ text }],
      },
      ...(taskType ? { taskType } : {}),
      ...(title ? { title } : {}),
    });

    return {
      text,
      embedding: Array.from(result.embedding.values),
      dimensions: result.embedding.values.length,
      model,
      ...(taskType ? { taskType } : {}),
    };
  } catch (error) {
    console.error("Error generating text embedding:", error);
    throw error;
  }
}

/**
 * Batch generates embeddings for multiple texts
 * @param texts Array of texts to embed
 * @param options Configuration options
 * @returns Promise with array of embedding results
 */
export async function batchGenerateTextEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<EmbeddingResult[]> {
  const generativeModel = genAI.getGenerativeModel({
    model: options.model || "text-embedding-004",
  });

  const batchResult = await generativeModel.batchEmbedContents({
    requests: texts.map((text) => ({
      content: {
        role: "user",
        parts: [{ text }],
      },
      ...(options.taskType ? { taskType: options.taskType } : {}),
      ...(options.title ? { title: options.title } : {}),
    })),
  });

  return batchResult.embeddings.map((embedding, index) => ({
    text: texts[index],
    embedding: Array.from(embedding.values),
    dimensions: embedding.values.length,
    model: options.model || "text-embedding-004",
    ...(options.taskType ? { taskType: options.taskType } : {}),
  }));
}
