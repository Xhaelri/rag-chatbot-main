const { GITHUB_TOKEN, MODEL_BASE_URL, OPENROUTER_API_KEY_GEMINI } = process.env;

import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: MODEL_BASE_URL,
  apiKey: OPENROUTER_API_KEY_GEMINI,
  timeout: 30000, // 30 second timeout for requests
  maxRetries: 2, // Retry failed requests twice
});

export default openai;
