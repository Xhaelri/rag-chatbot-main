import axios from "axios";
import dotenv from "dotenv";
dotenv.config({path: "./.env"});

const { SENTENCE_TRANSFORMER_API_URL } = process.env;

// Default model configuration
const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIMENSION = 384;

interface EmbeddingOptions {
  model?: string;
  normalize?: boolean;
}

interface EmbeddingResult {
  text: string;
  embedding: number[];
  dimensions: number;
  model: string;
}

/**
 * Generates text embeddings using sentence-transformers model
 * @param text Input text to embed
 * @param options Configuration options
 * @returns Promise with embedding result
 */
export async function generateSentenceEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<EmbeddingResult> {
  try {
    // Validate input
    if (!text || typeof text !== "string") {
      throw new Error("Text must be a non-empty string");
    }

    const { model = DEFAULT_MODEL, normalize = true } = options;

    // Ensure the URL includes the /embed endpoint
    const response = await axios.post(`${SENTENCE_TRANSFORMER_API_URL}/embed`, {
      text,
      model: model,
      normalize: true,
    });

    const embedding = response.data.embedding;

    return {
      text,
      embedding,
      dimensions: embedding.length,
      model,
    };
  } catch (error) {
    console.error(
      "Error generating sentence embedding:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

/**
 * Batch generates embeddings for multiple texts
 * @param texts Array of texts to embed
 * @param options Configuration options
 * @returns Promise with array of embedding results
 */
export async function batchGenerateSentenceEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<EmbeddingResult[]> {
  try {
    // Validate input
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new Error("Texts must be a non-empty array of strings");
    }

    const { model = DEFAULT_MODEL, normalize = true } = options;

    // API call to your sentence-transformer service
    const response = await axios.post(
      process.env.SENTENCE_TRANSFORMER_API_URL ||
        "http://localhost:8000/embed-batch",
      {
        texts,
        model,
        normalize,
      }
    );

    return texts.map((text, index) => ({
      text,
      embedding: response.data.embeddings[index],
      dimensions: response.data.embeddings[index].length,
      model,
    }));
  } catch (error) {
    console.error("Error batch generating sentence embeddings:", error);
    throw error;
  }
}
