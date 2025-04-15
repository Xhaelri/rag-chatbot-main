// scripts/test-embedding.ts
import { generateSentenceEmbedding } from "../lib/sentence-transformer-embedding";
import dotenv from 'dotenv';
dotenv.config();

async function testEmbedding() {
  try {
    console.log("Testing embedding pipeline...");
    console.log("API URL:", process.env.SENTENCE_TRANSFORMER_API_URL);
    
    const result = await generateSentenceEmbedding("This is a test sentence.");
    
    console.log("Embedding successfully generated!");
    console.log("Embedding dimension:", result.embedding.length);
    console.log("Model used:", result.model);
    console.log("First 5 values:", result.embedding.slice(0, 5));
  } catch (error) {
    console.error("Error generating embedding:", error);
    if (error.response) {
      console.error("Response error data:", error.response.data);
      console.error("Response error status:", error.response.status);
    }
  }
}

// Run the test
testEmbedding();