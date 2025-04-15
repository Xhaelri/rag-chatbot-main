import express from "express";
import cors from "cors";
import { pipeline } from "@xenova/transformers";

const app = express();
app.use(cors());
app.use(express.json());

// Cache the model to avoid reloading
let embeddingPipeline = null;

async function loadModel(modelName = "Xenova/all-MiniLM-L6-v2") {
  if (!embeddingPipeline) {
    console.log(`Loading model: ${modelName}`);
    embeddingPipeline = await pipeline("feature-extraction", modelName);
  }
  return embeddingPipeline;
}

// Normalize vector to unit length
function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map((val) => val / magnitude);
}

app.post("/embed", async (req, res) => {
  try {
    const {
      text,
      model = "Xenova/all-MiniLM-L6-v2",
      normalize = true,
    } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const pipeline = await loadModel(model);
    let embedding = await pipeline(text, { pooling: "mean", normalize: false });

    // Convert to regular array
    embedding = Array.from(embedding.data);

    // Normalize if requested
    if (normalize) {
      embedding = normalizeVector(embedding);
    }

    res.json({
      embedding,
      dimensions: embedding.length,
      model,
    });
  } catch (error) {
    console.error("Embedding error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/embed-batch", async (req, res) => {
  try {
    const {
      texts,
      model = "Xenova/all-MiniLM-L6-v2",
      normalize = true,
    } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: "Texts array is required" });
    }

    const pipeline = await loadModel(model);

    // Process all texts
    const embeddings = await Promise.all(
      texts.map(async (text) => {
        let embedding = await pipeline(text, {
          pooling: "mean",
          normalize: false,
        });
        embedding = Array.from(embedding.data);

        if (normalize) {
          embedding = normalizeVector(embedding);
        }

        return embedding;
      })
    );

    res.json({
      embeddings,
      dimensions: embeddings[0].length,
      model,
    });
  } catch (error) {
    console.error("Batch embedding error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Sentence Transformer API running on port ${PORT}`);
});
