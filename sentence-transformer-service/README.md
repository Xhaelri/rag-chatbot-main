# Sentence Transformer Integration

This project integrates the `sentence-transformers/multilingual-e5-large` model which produces 1024-dimensional embeddings optimized for cosine similarity.

## Setup Instructions

### 1. Embedding Service

The project includes a standalone embedding service that runs the sentence transformer model. To set it up:

```bash
cd sentence-transformer-service
npm install
npm run dev
```

This will start the embedding service on port 8000.

### 2. Environment Variables

Add the following to your .env file:

```
SENTENCE_TRANSFORMER_API_URL=http://localhost:8000
```

### 3. Database Configuration

If you're creating a new Astra DB collection for this project, ensure it uses:

- 1024 dimensions (instead of 768)
- "cosine" as the similarity metric

### 4. Data Migration

If you have existing data with different embedding dimensions, you'll need to:

1. Create a new collection with 1024 dimensions
2. Re-embed your data using the sentence transformer model
3. Insert the new embeddings into the new collection

## API Usage

The embedding service provides two endpoints:

- `/embed` - Embed a single text
- `/embed-batch` - Embed multiple texts in one request

Example usage:

```javascript
// Single embedding
const response = await fetch("http://localhost:8000/embed", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Your text here" }),
});
const result = await response.json();
const embedding = result.embedding;

// Batch embedding
const batchResponse = await fetch("http://localhost:8000/embed-batch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ texts: ["Text 1", "Text 2", "Text 3"] }),
});
const batchResult = await batchResponse.json();
const embeddings = batchResult.embeddings;
```

## Model Information

- **Model**: sentence-transformers/multilingual-e5-large
- **Dimensions**: 1024
- **Similarity Metric**: Cosine similarity
- **Normalized**: Yes (vectors are normalized to unit length)
