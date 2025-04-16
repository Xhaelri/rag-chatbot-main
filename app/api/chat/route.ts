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
    const latestMessage = messages[messages.length - 1]?.content; // Validate input

    if (!latestMessage || typeof latestMessage !== "string") {
      return new Response(
        JSON.stringify({
          error: "Invalid message format",
        }),
        { status: 400 }
      );
    }

    console.log("Processing query:", latestMessage.substring(0, 50)); // Generate embeddings using sentence-transformer model

    console.log("Generating embedding for query...");
    const embeddingResult = await generateSentenceEmbedding(latestMessage);
    const embeddingVector = embeddingResult.embedding;
    console.log("Embedding vector length:", embeddingVector.length); // Retrieve context from Astra DB

    let docContext = "";
    let relevantDocsFound = false;
    try {
      console.log("Querying vector database...");
      const collection = db.collection(ASTRA_DB_COLLECTION!); // Log collection info

      console.log(`Using collection: ${ASTRA_DB_COLLECTION}`); // Verify collection exists

      const documentCheck = await collection.findOne({});
      if (!documentCheck) {
        console.warn(
          "WARNING: No documents found in collection. Check data loading."
        );
        docContext = "لم يتم العثور على مستندات في قاعدة المعرفة."; // Arabic
      } else {
        // Enhanced search query:
        // First try exact keyword match if it's just "taskrabbit" (or similar common term)
        let documents = [];
        const trimmedQuery = latestMessage.toLowerCase().trim();

        if (trimmedQuery === "taskrabbit" || trimmedQuery === "تاسك رابيت") {
          // For specific keywords, maybe find general info
          const cursor = collection.find({}, { limit: 10 });
          documents = await cursor.toArray();
          console.log(
            `Found ${documents.length} documents with basic query for '${trimmedQuery}'`
          );
        } else {
          // For more complex queries, use vector search
          const cursor = collection.find(null, {
            sort: { $vector: embeddingVector },
            limit: 15, // Increased limit
            includeSimilarity: true,
          });

          console.log("Vector search params:", {
            vectorLength: embeddingVector.length,
            collectionName: ASTRA_DB_COLLECTION,
          });
          documents = await cursor.toArray();
          console.log(
            `Found ${documents.length} potential documents via vector search`
          );
        } // Filter documents based on similarity threshold

        let relevantDocuments = documents;
        if (documents.length > 0 && documents[0]?._similarity !== undefined) {
          relevantDocuments = documents.filter(
            (doc) =>
              doc._similarity !== undefined && doc._similarity >= MIN_SIMILARITY
          );
          console.log(
            `${relevantDocuments.length} documents meet similarity threshold of ${MIN_SIMILARITY}`
          );
        } else if (documents.length > 0) {
          // If similarity isn't included (e.g., basic query), maybe keep all or apply different logic
          console.log(
            `Using all ${documents.length} found documents (similarity not available or not used for filtering)`
          );
          relevantDocuments = documents;
        } else {
          console.log("No potential documents found.");
          relevantDocuments = [];
        }

        if (relevantDocuments.length > 0) {
          relevantDocsFound = true; // Debug: Show detailed information about documents

          console.log("First relevant document:", {
            text_preview: relevantDocuments[0].text.substring(0, 100),
            similarity: relevantDocuments[0]._similarity || "N/A",
          }); // Create formatted context with more details

          docContext = relevantDocuments
            .map((doc, i) => {
              const similarity = doc._similarity
                ? `(مدى الصلة: ${doc._similarity.toFixed(2)})` // Arabic
                : "(درجة الصلة غير متوفرة)"; // Arabic // Add a title if available, otherwise use first line as title

              const title =
                doc.title || doc.text.split("\n")[0].substring(0, 50) + "...";

              return `--- المستند ${i + 1}: ${title} ${similarity} ---\n${
                // Arabic
                doc.text
              }\n--- نهاية المستند ${i + 1} ---`; // Arabic
            })
            .join("\n\n"); // Limit context size if too large

          if (docContext.length > MAX_CONTEXT_LENGTH) {
            console.log(
              `Context too large (${docContext.length} chars), truncating...`
            );
            docContext =
              docContext.substring(0, MAX_CONTEXT_LENGTH) +
              "\n[تم اقتطاع السياق بسبب الطول الزائد]"; // Arabic
          }

          console.log("Context length:", docContext.length);
        } else {
          console.warn("No documents meet the criteria for this query.");
          docContext =
            "لم يتم العثور على معلومات ذات صلة كافية في قاعدة المعرفة لهذا الاستعلام."; // Arabic
        }
      }
    } catch (error) {
      console.error("DB query error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      docContext = "حدث خطأ أثناء استرداد معلومات السياق."; // Arabic
    } // --- NEW ARABIC SYSTEM PROMPT ---

    // --- REVISED ARABIC SYSTEM PROMPT (Focus on Direct Listing) ---
    const systemPrompt = `
    أنت مساعد ذكي ومتعاون، هدفك الأساسي هو مساعدة المستخدمين في إيجاد حلول لمشاكلهم المنزلية أو اقتراح خدمات الحرفيين عند الحاجة.
    
    ### السياق المسترجع (قد يحتوي على معلومات أو قوائم حرفيين) ###
    ${docContext}
    ### نهاية السياق ###
    
    🟢 تعليمات العمل:
    
    1. **إذا طلب المستخدم حرفي محدد بشكل صريح** (مثل: "أحتاج سباك"، "أريد كهربائي"، "دلني على نجار"):
        - **أولاً:** ابحث بدقة في \`السياق المسترجع\` (${docContext}) عن **قائمة حرفيين** تطابق النوع المطلوب.
        - **إذا وجدت قائمة:** اعرضها مباشرة باستخدام تنسيق واضح بــ Markdown، واذكر المعلومات المتاحة (الاسم، التخصص، التقييم إن وُجد).
        - **إذا لم تجد قائمة:** أخبر المستخدم بوضوح أنك لم تعثر على قائمة لهذا النوع من الحرفيين في السياق الحالي، ثم اقترح عليه استخدام موقعنا "حرفي" للبحث عن حرفيين مناسبين.
    
    2. **إذا كان طلب المستخدم يتعلق بحل مشكلة منزلية أو استفسار عام** (ولم يطلب حرفي بشكل صريح):
        - حاول أولاً تقديم نصائح عملية وخطوات لمساعدته على حل المشكلة بنفسه.
        - استعن بـ \`السياق المسترجع\` إن كان يحتوي على معلومات مفيدة لدعم النصيحة.
        - **لا تقترح التواصل مع حرفي** إلا إذا:
            - تبين أن الحل يتطلب تدخلاً متخصصاً.
            - أو طلب المستخدم ذلك صراحة أثناء المحادثة.
    
    3. **الشفافية والوضوح:**
        - كن واضحًا دائمًا بشأن مصدر المعلومات: هل النصيحة أو الأسماء مأخوذة من السياق أم من معرفتك العامة.
        - لا تختلق معلومات أو قوائم إذا لم تكن موجودة في السياق.
    
    4. **تنسيق الرد:**
        - استخدم Markdown لجعل الإجابات مرتبة وسهلة القراءة.
    
    5. **اللغة:**
        - تحدث باللغة العربية الفصحى الواضحة.
    
    هدفك هو جعل تجربة المستخدم سهلة وفعالة، مع إعطاء الأولوية لمساعدته في اتخاذ قرار مناسب سواء عبر نصيحة عملية أو توصية بحرفي من السياق.
    `;
    
    console.log("System prompt length:", systemPrompt.length);
    console.log(
      "System prompt preview (Arabic):", // Indicate language
      systemPrompt.substring(0, 250) + "..." // Show a bit more for Arabic
    );

    // Optional: Keep debug info in English for developers, or translate it
    const debugInfo = relevantDocsFound
      ? `[DEBUG: Found ${
          // Count based on the Arabic delimiter
          docContext.split("--- المستند").length - 1
        } relevant documents]`
      : "[DEBUG: No relevant documents found in the database]"; // Build messages with system message

    const allMessages: Message[] = [
      {
        id: generateId(),
        role: "system",
        content: systemPrompt,
      }, // Keep debug message for developers - uncomment if needed during testing // { //   id: generateId(), //   role: "system", //   content: debugInfo, // },
      ...messages.map((m: any) => ({
        id: generateId(),
        role: m.role,
        content: m.content,
      })),
    ];

    console.log("Creating AI stream with Gemini...");
    console.log("Total messages:", allMessages.length); // Create the AI stream using Google Gemini

    const result = await streamText({
      model: google("gemini-1.5-flash"), // Using flash model as specified before
      messages: allMessages,
      temperature: 0.3, // Slightly increased temperature for more conversational help
    }); // Return the stream

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("API error:", error);
    console.error(
      error instanceof Error ? error.stack : "No stack trace available"
    );
    return new Response(
      JSON.stringify({
        error: "Internal server error", // Keep technical errors in English potentially
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
