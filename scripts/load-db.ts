import { DataAPIClient } from "@datastax/astra-db-ts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import dotenv from 'dotenv';
dotenv.config();
// Import our new embedding function
import { generateSentenceEmbedding } from "../lib/sentence-transformer-embedding";

type SimilarityMetric = "cosine" | "dot_product" | "euclidean";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  SENTENCE_TRANSFORMER_API_URL,
} = process.env;

// Expanded list of URLs to scrape - add more TaskRabbit pages
const scrapeUrls = [
  "https://www.taskrabbit.com/",
  "https://www.taskrabbit.com/services",
  "https://www.taskrabbit.com/how-it-works",
  "https://www.taskrabbit.com/about"
];

// Fixed DataAPIClient initialization with the required parameters
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!, {
  // Removed apiUrl as it is not a valid property
});

const db = client.db(ASTRA_DB_API_ENDPOINT!, { keyspace: ASTRA_DB_NAMESPACE });

// Improved text splitter with larger chunks and more overlap
const text_splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 768,
  chunkOverlap: 150,
});

// Updated to 384 dimensions for sentence-transformers/all-MiniLM-L6-v2
const embeddingDimension = 384;

// Add this at the start of load-db.ts
console.log("Environment variables check:");
console.log("ASTRA_DB_NAMESPACE:", !!ASTRA_DB_NAMESPACE);
console.log("ASTRA_DB_COLLECTION:", !!ASTRA_DB_COLLECTION);
console.log("ASTRA_DB_API_ENDPOINT:", !!ASTRA_DB_API_ENDPOINT);
console.log("ASTRA_DB_APPLICATION_TOKEN:", !!ASTRA_DB_APPLICATION_TOKEN);
console.log("SENTENCE_TRANSFORMER_API_URL:", !!SENTENCE_TRANSFORMER_API_URL);

// Helper to check if collection exists and has correct settings
async function checkCollection() {
  try {
    const collection = await db.collection(ASTRA_DB_COLLECTION!);
    const count = await collection.countDocuments({}, 1000); // Adjust upperBound as needed
    console.log(`Collection ${ASTRA_DB_COLLECTION} exists with ${count} documents`);
    return {exists: true, count};
  } catch (error) {
    return {exists: false, count: 0};
  }
}

const createCollection = async (
  similarityMetric: SimilarityMetric = "cosine"
) => {
  try {
    // Check if collection already exists
    const collectionStatus = await checkCollection();
    
    if (collectionStatus.exists) {
      console.log(`Collection ${ASTRA_DB_COLLECTION} already exists with ${collectionStatus.count} documents`);
      
      // If we have a collection that's problematic, we can consider recreating it
      if (collectionStatus.count === 0) {
        console.log("Collection exists but is empty. Consider dropping and recreating it.");
      }
      
      // Make sure we have required environment variables
      if (!ASTRA_DB_NAMESPACE || !ASTRA_DB_COLLECTION || !ASTRA_DB_API_ENDPOINT || !ASTRA_DB_APPLICATION_TOKEN || !SENTENCE_TRANSFORMER_API_URL) {
        throw new Error("Missing required environment variables");
      }
      
      return; // Skip creation
    }
    
    // Collection doesn't exist, create it
    const res = await db.createCollection(ASTRA_DB_COLLECTION!, {
      vector: {
        dimension: embeddingDimension,
        metric: similarityMetric,
      },
    });
    console.log(res);
  } catch (error) {
    // Better error handling for collection creation
    if (error.name === "CollectionAlreadyExistsError") {
      console.log(`Collection ${ASTRA_DB_COLLECTION} already exists. Skipping creation.`);
      if (!ASTRA_DB_NAMESPACE || !ASTRA_DB_COLLECTION || !ASTRA_DB_API_ENDPOINT || !ASTRA_DB_APPLICATION_TOKEN || !SENTENCE_TRANSFORMER_API_URL) {
        throw new Error("Missing required environment variables");
      }
    } else if (error.message && error.message.includes("different settings")) {
      // Handle the case where collection exists with different settings
      console.error("Collection exists with different settings. Consider using a different collection name or dropping the existing one.");
      throw error;
    } else {
      console.error("Error creating collection:", error);
      throw error;
    }
  }
};

export const loadSampleData = async () => {
  console.log("Starting to load sample data...");
  try {
    const collection = await db.collection(ASTRA_DB_COLLECTION!);
    
    // Check if collection exists and is accessible
    console.log(`Connected to collection: ${ASTRA_DB_COLLECTION}`);
    
    let totalDocuments = 0;
    
    for (const url of scrapeUrls) {
      console.log(`Processing URL: ${url}`);
      const content = await scrapePage(url);
      
      if (!content || content.trim() === "") {
        console.warn(`No content scraped from ${url}, skipping`);
        continue;
      }
      
      console.log(`Content length: ${content.length} characters`);
      const chunks = await text_splitter.splitText(content);
      console.log(`Split into ${chunks.length} chunks`);
      
      // Extract title from the first chunk for metadata
      const pageTitle = content.split('\n')[0].trim();
      
      for (const chunk of chunks) {
        if (chunk.trim() === "") {
          console.warn("Empty chunk, skipping");
          continue;
        }
        
        try {
          console.log(`Processing chunk: ${chunk.substring(0, 50)}...`);
          const embeddingResult = await generateSentenceEmbedding(chunk);
          const vector = embeddingResult.embedding;
          
          // Add more metadata and a keyword for better searchability
          const res = await collection.insertOne({
            $vector: vector,
            text: chunk,
            title: pageTitle,
            sourceUrl: url,
            keywords: ["taskrabbit", "task rabbit", "home services"],
            timestamp: new Date().toISOString()
          });
          
          console.log(`Document inserted with ID: ${res.insertedId}`);
          totalDocuments++;
        } catch (error) {
          console.error("Error processing chunk:", error);
        }
      }
    }
    
    console.log(`Total documents inserted: ${totalDocuments}`);
  } catch (error) {
    console.error("Error in loadSampleData:", error);
    throw error;
  }
};

async function scrapePage(url: string) {
  console.log(`Starting to scrape: ${url}`);
  
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Set more browser-like behavior
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    
    // Set a user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Navigate to URL with longer timeout
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 90000 
    });
    
    // Wait a bit for any JavaScript to execute
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract the page title for metadata
    const pageTitle = await page.title();
    
    // Extract text content with improved approach
    const content = await page.evaluate(() => {
      // Function to get visible text from node, with better formatting
      function getVisibleText(node) {
        let text = '';
        
        // Skip script, style tags, etc.
        const tagsToSkip = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG'];
        if (node.tagName && tagsToSkip.includes(node.tagName)) {
          return '';
        }
        
        if (node.nodeType === Node.TEXT_NODE) {
          let nodeText = node.textContent.trim();
          if (nodeText) {
            text += nodeText + ' ';
          }
        } else {
          const style = window.getComputedStyle(node);
          if (style && style.display !== 'none' && style.visibility !== 'hidden') {
            // Check if this is a heading tag
            if (node.tagName && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.tagName)) {
              const headingText = node.textContent.trim();
              if (headingText) {
                text += '\n\n' + headingText + '\n\n';
              }
            } 
            // Check if this is a paragraph
            else if (node.tagName === 'P') {
              const pText = node.textContent.trim();
              if (pText) {
                text += pText + '\n\n';
              }
            }
            // Process other elements
            else {
              for (let child of node.childNodes) {
                text += getVisibleText(child);
              }
              
              // Add breaks for certain elements
              if (['DIV', 'SECTION', 'ARTICLE'].includes(node.tagName)) {
                text += '\n';
              }
            }
          }
        }
        return text;
      }
      
      // Try to get main content first, fall back to body
      const mainContent = document.querySelector('main') || document.querySelector('article') || document.body;
      
      // Add page title at the beginning
      return document.title + '\n\n' + getVisibleText(mainContent);
    });
    
    // Log and close browser
    console.log(`Extracted ${content.length} characters of text`);
    console.log(`Sample: ${content.substring(0, 200)}`);
    await browser.close();
    
    return content;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return "";
  }
}

// Helper function to delete collection if needed (useful for reset)
async function deleteCollection() {
  try {
    await db.dropCollection(ASTRA_DB_COLLECTION!);
    console.log(`Collection ${ASTRA_DB_COLLECTION} deleted successfully`);
    return true;
  } catch (error) {
    console.error("Error deleting collection:", error);
    return false;
  }
}

// Add debug function to check database contents
async function debugDbContents() {
  try {
    const collection = await db.collection(ASTRA_DB_COLLECTION!);
    const count = await collection.countDocuments({}, 1000);
    console.log(`Total documents in ${ASTRA_DB_COLLECTION}: ${count}`);
    
    if (count > 0) {
      const sample = await collection.findOne({});
      console.log("Sample document:", {
        id: sample._id,
        text_preview: sample.text.substring(0, 100),
        title: sample.title || "No title",
        keywords: sample.keywords || "No keywords",
        vector_length: sample.$vector ? sample.$vector.length : 'No vector found'
      });
    }
  } catch (error) {
    console.error("Error debugging DB contents:", error);
  }
}

// Main execution
createCollection()
  .then(() => loadSampleData())
  .then(() => debugDbContents())
  .catch(error => {
    console.error("Script failed:", error);
    process.exit(1);
  });