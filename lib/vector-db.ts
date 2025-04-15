import { Collection, DataAPIClient } from "@datastax/astra-db-ts";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
} = process.env;

if (!ASTRA_DB_API_ENDPOINT || !ASTRA_DB_APPLICATION_TOKEN) {
  throw new Error("Missing Astra DB configuration in environment variables");
}

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { keyspace: ASTRA_DB_NAMESPACE });

// Changed from 768 to 1024 for sentence-transformers/multilingual-e5-large
const EMBED_DIMENSION = 1024;

type SimilarityMetric = "cosine" | "dot_product" | "euclidean";
type VectorDoc = {
  _id?: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
  $vector?: number[];
  createdAt?: Date;
  _similarity?: number;
};

/**
 * Creates a vector collection with specified configuration
 */
async function createVectorCollection(
  dimension: number = EMBED_DIMENSION,
  metric: SimilarityMetric = "cosine"
): Promise<Collection<VectorDoc>> {
  try {
    return await db.createCollection(
      ASTRA_DB_COLLECTION || "vector_collection",
      {
        vector: {
          dimension,
          metric,
        },
      }
    );
  } catch (error) {
    console.error("Error creating collection:", error);
    throw new Error("Failed to create vector collection");
  }
}

/**
 * Initializes and returns the vector collection
 * Creates it if it doesn't exist
 */
export async function getVectorCollection(
  dimension: number = EMBED_DIMENSION
): Promise<Collection<VectorDoc>> {
  try {
    const collectionName = ASTRA_DB_COLLECTION || "vector_collection";
    const collections = await db.listCollections();
    const exists = collections.some((c) => c.name === collectionName);

    if (!exists) {
      console.log(`Creating new collection ${collectionName}...`);
      return await createVectorCollection(dimension);
    }

    return await db.collection<VectorDoc>(collectionName);
  } catch (error) {
    console.error("Error initializing collection:", error);
    throw new Error("Failed to initialize vector collection");
  }
}

/**
 * Inserts a vector document into the collection
 */
export async function insertVector(
  text: string,
  embedding: number[],
  metadata?: Record<string, any>
): Promise<string> {
  try {
    const collection = await getVectorCollection(embedding.length);
    const doc: VectorDoc = {
      text,
      embedding,
      metadata,
      $vector: embedding, // Astra requires $vector field for vector search
    };
    const result = await collection.insertOne(doc);
    return result.insertedId;
  } catch (error) {
    console.error("Error inserting vector:", error);
    throw new Error("Failed to insert vector");
  }
}

/**
 * Inserts multiple vector documents into the collection
 */
export async function insertManyVectors(
  texts: string[],
  embeddings: number[][],
  metadata?: Record<string, any>[] // Optional metadata for each document
): Promise<{ success: boolean; insertedCount: number }> {
  try {
    // Validate input
    if (texts.length !== embeddings.length) {
      throw new Error("Texts and embeddings arrays must have the same length");
    }

    const collection = await getVectorCollection(embeddings[0].length);

    // Prepare documents with optional metadata
    const documents = texts.map((text, index) => ({
      text,
      embedding: embeddings[index], // Stored for reference
      $vector: embeddings[index], // Required for vector search
      createdAt: new Date(),
      ...(metadata && metadata[index] ? { metadata: metadata[index] } : {}),
    }));

    // Batch insert
    const result = await collection.insertMany(documents);

    return {
      success: true,
      insertedCount: result.insertedCount,
    };
  } catch (error) {
    console.error("Error bulk inserting vectors:", error);
    throw new Error(
      `Failed to insert vectors: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Finds similar vectors using ANN search
 */
/**
 * Finds similar vectors using ANN search with fallback similarity calculation
 */
export async function findSimilarVectors(
  embedding: number[],
  limit: number = 10,
  minSimilarity: number = 0.5
) {
  try {
    const collection = await getVectorCollection(embedding.length);
    console.log("Searching for similar vectors...");
    console.log(`Vector dimensions: ${embedding.length}`);

    // First, check if we can get a sample document to verify collection structure
    const sampleDoc = await collection.findOne({});
    if (sampleDoc) {
      console.log(
        "Sample document structure available:",
        JSON.stringify(
          {
            hasVector:
              !!(sampleDoc as VectorDoc).$vector || !!sampleDoc.embedding,
            vectorLength: (
              (sampleDoc as VectorDoc).$vector ||
              sampleDoc.embedding ||
              []
            ).length,
            docFields: Object.keys(sampleDoc),
          },
          null,
          2
        )
      );
    } else {
      console.warn(
        "No documents found in collection. Check your data loading."
      );
    }

    // Perform vector search
    const results = await collection.find(
      {},
      {
        sort: { $vector: embedding },
        limit,
        includeSimilarity: true,
      }
    );

    const documents = await results.toArray();

    // Calculate similarity scores if they're missing
    const documentsWithScores = documents.map((doc) => {
      // If similarity is undefined, calculate it
      if (doc._similarity === undefined) {
        if ((doc as VectorDoc).$vector) {
          doc._similarity = calculateCosineSimilarity(
            embedding,
            (doc as VectorDoc).$vector!
          );
          console.log(
            `Calculated similarity for doc: ${doc._similarity.toFixed(4)}`
          );
        } else if (doc.embedding) {
          doc._similarity = calculateCosineSimilarity(embedding, doc.embedding);
          console.log(
            `Calculated similarity from embedding: ${doc._similarity.toFixed(
              4
            )}`
          );
        } else {
          console.warn("Document missing vector data:", doc._id);
          doc._similarity = 0;
        }
      }
      return doc;
    });

    // Log detailed information about what was retrieved
    console.log(
      `Retrieved ${documentsWithScores.length} documents from database`
    );
    console.log("--- Similarity Scores ---");
    documentsWithScores.forEach((doc, index) => {
      console.log(
        `Document ${index + 1} (${doc._id}): Score ${doc._similarity?.toFixed(
          4
        )}`
      );
      console.log(`  Preview: ${doc.text.substring(0, 100)}...`);
    });

    // Filter by minimum similarity if specified
    const filteredDocs =
      minSimilarity > 0
        ? documentsWithScores.filter(
            (doc) => (doc._similarity || 0) >= minSimilarity
          )
        : documentsWithScores;

    console.log(
      `${filteredDocs.length} documents passed the similarity threshold of ${minSimilarity}`
    );

    return filteredDocs;
  } catch (error) {
    console.error("Error finding similar vectors:", error);
    throw new Error(
      `Failed to perform vector search: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    console.error("Invalid vectors for similarity calculation");
    return 0;
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  // Prevent division by zero
  const magnitudeProduct = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitudeProduct === 0) return 0;

  return dotProduct / magnitudeProduct;
}
