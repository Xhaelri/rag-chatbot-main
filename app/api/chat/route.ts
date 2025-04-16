import { DataAPIClient } from "@datastax/astra-db-ts";
import { generateId, Message, streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateSentenceEmbedding } from "@/lib/sentence-transformer-embedding";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  GOOGLE_API_KEY,
} = process.env;

// Verify environment variables
console.log("Environment check:", {
  hasNamespace: !!ASTRA_DB_NAMESPACE,
  hasCollection: !!ASTRA_DB_COLLECTION,
  hasEndpoint: !!ASTRA_DB_API_ENDPOINT,
  hasToken: !!ASTRA_DB_APPLICATION_TOKEN,
  hasGoogleKey: !!GOOGLE_API_KEY,
});

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { keyspace: ASTRA_DB_NAMESPACE });

// Create Google Generative AI provider
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || "",
});

// Maximum context length for the model
const MAX_CONTEXT_LENGTH = 30000;

// Reduced similarity threshold for better matching
const MIN_SIMILARITY = 0.2;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1]?.content;

    // Validate input
    if (!latestMessage || typeof latestMessage !== "string") {
      return new Response(
        JSON.stringify({
          error: "Invalid message format",
        }),
        { status: 400 }
      );
    }

    console.log("Processing query:", latestMessage.substring(0, 50));

    // Generate embeddings using sentence-transformer model
    console.log("Generating embedding for query...");
    const embeddingResult = await generateSentenceEmbedding(latestMessage);
    const embeddingVector = embeddingResult.embedding;
    console.log("Embedding vector length:", embeddingVector.length);

    // Retrieve context from Astra DB
    let docContext = "";
    let relevantDocsFound = false;
    try {
      console.log("Querying vector database...");
      const collection = db.collection(ASTRA_DB_COLLECTION!);

      // Log collection info
      console.log(`Using collection: ${ASTRA_DB_COLLECTION}`);

      // Verify collection exists
      const documentCheck = await collection.findOne({});
      if (!documentCheck) {
        console.warn(
          "WARNING: No documents found in collection. Check data loading."
        );
        docContext = "No documents found in the knowledge base.";
      } else {
        // Enhanced search query:
        // First try exact keyword match if it's just "taskrabbit"
        let documents = [];
        
        if (latestMessage.toLowerCase().trim() === "taskrabbit") {
          // For single-word queries like "taskrabbit", try to find any documents
          const cursor = collection.find({}, {
            limit: 10,
          });
          documents = await cursor.toArray();
          console.log(`Found ${documents.length} documents with basic query`);
        } else {
          // For more complex queries, use vector search
          const cursor = collection.find(null, {
            sort: { $vector: embeddingVector },
            limit: 15, // Increased limit to find more potential matches
            includeSimilarity: true,
          });

          // Add more detailed logging
          console.log("Vector search params:", {
            vectorLength: embeddingVector.length,
            collectionName: ASTRA_DB_COLLECTION,
          });
          documents = await cursor.toArray();
          console.log(`Found ${documents.length} potential documents`);
        }

        // Filter documents based on similarity threshold (if similarity is available)
        let relevantDocuments = documents;
        if (documents.length > 0 && documents[0]._similarity !== undefined) {
          relevantDocuments = documents.filter(
            (doc) =>
              doc._similarity !== undefined && doc._similarity >= MIN_SIMILARITY
          );
          
          console.log(
            `${relevantDocuments.length} documents meet similarity threshold of ${MIN_SIMILARITY}`
          );
        } else {
          console.log("Using all found documents without similarity filtering");
        }

        if (relevantDocuments.length > 0) {
          relevantDocsFound = true;

          // Debug: Show detailed information about documents
          console.log("First relevant document:", {
            text_preview: relevantDocuments[0].text.substring(0, 100),
            similarity: relevantDocuments[0]._similarity || "N/A",
          });

          // Create formatted context with more details
          docContext = relevantDocuments
            .map((doc, i) => {
              const similarity = doc._similarity
                ? `(Relevance: ${doc._similarity.toFixed(2)})`
                : "(Relevance score unavailable)";

              // Add a title if available, otherwise use first line as title
              const title =
                doc.title || doc.text.split("\n")[0].substring(0, 50) + "...";

              return `--- DOCUMENT ${i + 1}: ${title} ${similarity} ---\n${
                doc.text
              }\n--- END DOCUMENT ${i + 1} ---`;
            })
            .join("\n\n");

          // Limit context size if too large
          if (docContext.length > MAX_CONTEXT_LENGTH) {
            console.log(
              `Context too large (${docContext.length} chars), truncating...`
            );
            docContext =
              docContext.substring(0, MAX_CONTEXT_LENGTH) +
              "\n[Context truncated due to length]";
          }

          console.log("Context length:", docContext.length);
        } else {
          console.warn(
            "No documents meet the criteria for this query."
          );
          docContext =
            "No sufficiently relevant information found in the knowledge base for this query.";
        }
      }
    } catch (error) {
      console.error("DB query error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      docContext = "Error retrieving context information.";
    }

    // Create an improved system prompt with clearer instructions
    const systemPrompt = `
You are a knowledgeable assistant specializing in TaskRabbit information. Your task is to provide helpful responses to user questions based on the retrieved context.

### RETRIEVED CONTEXT ###
${docContext}
### END CONTEXT ###

IMPORTANT INSTRUCTIONS:
1. Base your answers ONLY on the retrieved context above.
2. If the context clearly doesn't contain relevant information, respond with: "I don't have specific information about that in my retrieved context."
3. Use direct quotes from the context when appropriate to support your answers.
4. Use markdown for formatting.
5. Be precise and factual.
6. Only reference information that appears in the context.
7. Never make up information or claim knowledge beyond what's provided in the context.
8. If the context is partially relevant but doesn't fully answer the query, clarify which parts of the question you can address based on the available information.

If you're unsure whether the context provides sufficient information, err on the side of caution and acknowledge the limitations of your knowledge.
`;

    console.log("System prompt length:", systemPrompt.length);
    console.log(
      "System prompt preview:",
      systemPrompt.substring(0, 200) + "..."
    );

    // Add debugging information to the conversation for developers
    // This helps you understand what's happening during testing
    const debugInfo = relevantDocsFound
      ? `[DEBUG: Found ${
          docContext.split("--- DOCUMENT").length - 1
        } relevant documents]`
      : "[DEBUG: No relevant documents found in the database]";

    // Build messages with system message
    const allMessages: Message[] = [
      {
        id: generateId(),
        role: "system",
        content: systemPrompt,
      },
      // Optional debugging message for development - uncomment for testing
      {
        id: generateId(),
        role: "system",
        content: debugInfo,
      },
      ...messages.map((m: any) => ({
        id: generateId(),
        role: m.role,
        content: m.content,
      })),
    ];

    console.log("Creating AI stream with Gemini...");
    console.log("Total messages:", allMessages.length);

    // Create the AI stream using Google Gemini
    const result = await streamText({
      model: google("gemini-1.5-flash"), // Use your Gemini model
      messages: allMessages,
      temperature: 0.2, // Lower temperature for more factual responses
    });

    // Return the stream
    return result.toDataStreamResponse();
  } catch (error) {
    console.error("API error:", error);
    console.error(
      error instanceof Error ? error.stack : "No stack trace available"
    );
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}