import { DataAPIClient } from "@datastax/astra-db-ts";
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();
// Import our embedding function
import { generateSentenceEmbedding } from "../lib/sentence-transformer-embedding";

type SimilarityMetric = "cosine" | "dot_product" | "euclidean";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  SENTENCE_TRANSFORMER_API_URL,
} = process.env;

// Craftsmen API configuration
const CRAFTSMEN_API_URL = "http://20.199.86.3/api/client/search";
const CRAFTSMEN_API_TOKEN = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vMjAuMTk5Ljg2LjMvYXBpL2NsaWVudC9sb2dpbiIsImlhdCI6MTc0NDc5MTI2OSwiZXhwIjoxNzYyNzkxMjY5LCJuYmYiOjE3NDQ3OTEyNjksImp0aSI6IkVRNjJHNzBtTktxWm5HUEQiLCJzdWIiOiIyMSIsInBydiI6IjQxZWZiN2JhZDdmNmY2MzJlMjQwNWJkM2E3OTNiOGE2YmRlYzY3NzcifQ.fvc0R4trbNB4A8gthDOURzPeoJ1ZSQc3FNdiPe-I-O4";

// List of crafts to fetch - customize this list based on your needs
const craftsToFetch = [
  "حداد", 
  "نجار", 
  "سباك", 
  "كهربائي", 
  "نقاش", 
  "فني تكييف", 
  "خراط"
];

// Fixed DataAPIClient initialization with the required parameters
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { keyspace: ASTRA_DB_NAMESPACE });

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
    const count = await collection.countDocuments({}, 1000);
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

// Fetch craftsmen data from API - FIXED VERSION
async function fetchCraftsmenData(craft: string, page: number = 1) {
  try {
    console.log(`Fetching ${craft} craftsmen data, page ${page}...`);
    
    // FIXED: Proper structure for axios request
    const response = await axios.post(
      CRAFTSMEN_API_URL, 
      // Request payload
      {
        pagination: 100,
        page,
        craft
      },
      // Request config
      {
        headers: {
          'Authorization': CRAFTSMEN_API_TOKEN,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.status === true) {
      console.log(`Successfully fetched ${response.data.data.data.length} ${craft} craftsmen from page ${page}`);
      return response.data.data;
    } else {
      console.error(`Error fetching ${craft} craftsmen:`, response.data);
      return null;
    }
  } catch (error) {
    console.error(`API error for ${craft}:`, error.message);
    // Enhanced error logging
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    }
    return null;
  }
}

// Alternative GET method implementation - uncomment if the POST method doesn't work
/*
async function fetchCraftsmenData(craft: string, page: number = 1) {
  try {
    console.log(`Fetching ${craft} craftsmen data, page ${page}...`);
    
    const response = await axios.get(
      CRAFTSMEN_API_URL, 
      {
        params: {
          pagination: 100,
          page,
          craft
        },
        headers: {
          'Authorization': CRAFTSMEN_API_TOKEN,
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.status === true) {
      console.log(`Successfully fetched ${response.data.data.data.length} ${craft} craftsmen from page ${page}`);
      return response.data.data;
    } else {
      console.error(`Error fetching ${craft} craftsmen:`, response.data);
      return null;
    }
  } catch (error) {
    console.error(`API error for ${craft}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    return null;
  }
}
*/

// Format craftsman data into searchable text
function formatCraftsmanData(craftsman) {
  let formattedText = `اسم الحرفي: ${craftsman.name}\n`;
  formattedText += `المهنة: ${craftsman.craft?.name || 'غير محدد'}\n`;
  formattedText += `العنوان: ${craftsman.address || 'غير محدد'}\n`;
  
  // Add cities
  if (craftsman.cities && craftsman.cities.length > 0) {
    formattedText += `المدن: ${craftsman.cities.map(c => c.city).join(', ')}\n`;
  }
  
  // Add ratings
  if (craftsman.average_rating) {
    formattedText += `التقييم: ${craftsman.average_rating} (عدد التقييمات: ${craftsman.number_of_ratings || 0})\n`;
  } else {
    formattedText += "التقييم: غير متوفر\n";
  }
  
  // Add job statistics
  formattedText += `الوظائف المنجزة: ${craftsman.done_jobs_num || 0}\n`;
  formattedText += `الوظائف النشطة: ${craftsman.active_jobs_num || 0}\n`;
  
  // Add description
  if (craftsman.description) {
    formattedText += `الوصف: ${craftsman.description}\n`;
  }
  
  // Add status
  formattedText += `الحالة: ${craftsman.status === 'free' ? 'متاح' : 'مشغول'}\n`;
  
  return formattedText;
}

export const loadSampleData = async () => {
  console.log("Starting to load craftsmen data...");
  try {
    const collection = await db.collection(ASTRA_DB_COLLECTION!);
    
    // Check if collection exists and is accessible
    console.log(`Connected to collection: ${ASTRA_DB_COLLECTION}`);
    
    let totalDocuments = 0;
    
    // Process each craft type
    for (const craft of craftsToFetch) {
      console.log(`Processing craft: ${craft}`);
      
      // Start with page 1
      let currentPage = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        const apiResponse = await fetchCraftsmenData(craft, currentPage);
        
        if (!apiResponse || !apiResponse.data || apiResponse.data.length === 0) {
          console.log(`No more data for ${craft}`);
          hasMorePages = false;
          continue;
        }
        
        const craftsmen = apiResponse.data;
        console.log(`Processing ${craftsmen.length} ${craft} craftsmen from page ${currentPage}`);
        
        // Process each craftsman
        for (const craftsman of craftsmen) {
          // Format craftsman data into searchable text
          const formattedText = formatCraftsmanData(craftsman);
          
          try {
            console.log(`Processing craftsman: ${craftsman.name}`);
            const embeddingResult = await generateSentenceEmbedding(formattedText);
            const vector = embeddingResult.embedding;
            
            // Add document to collection with metadata
            const res = await collection.insertOne({
              $vector: vector,
              text: formattedText,
              title: `${craftsman.name} - ${craftsman.craft?.name || 'حرفي'}`,
              sourceId: craftsman.id.toString(),
              craft: craftsman.craft?.name || '',
              cities: craftsman.cities?.map(c => c.city) || [],
              keywords: ["حرفي", craftsman.craft?.name || '', ...craftsman.cities?.map(c => c.city) || []],
              timestamp: new Date().toISOString(),
              rawData: craftsman // Store the full raw data for reference
            });
            
            console.log(`Document inserted with ID: ${res.insertedId}`);
            totalDocuments++;
          } catch (error) {
            console.error("Error processing craftsman:", error);
          }
        }
        
        // Check if there are more pages
        if (apiResponse.last_page > currentPage) {
          currentPage++;
        } else {
          hasMorePages = false;
        }
      }
    }
    
    console.log(`Total craftsmen documents inserted: ${totalDocuments}`);
  } catch (error) {
    console.error("Error in loadSampleData:", error);
    throw error;
  }
};

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
        title: sample.title || "No title",
        text_preview: sample.text.substring(0, 100),
        craft: sample.craft || "No craft",
        cities: sample.cities || "No cities",
        keywords: sample.keywords || "No keywords",
        vector_length: sample.$vector ? sample.$vector.length : 'No vector found'
      });
    }
  } catch (error) {
    console.error("Error debugging DB contents:", error);
  }
}

// Function to test API connection
async function testApiConnection() {
  console.log("Testing API connection...");
  try {
    // Try a simple request to test connectivity
    const testResponse = await axios.get(
      CRAFTSMEN_API_URL.replace('/search', ''), // Try the base endpoint
      {
        headers: {
          'Authorization': CRAFTSMEN_API_TOKEN,
          'Accept': 'application/json'
        }
      }
    );
    console.log("API connection test response status:", testResponse.status);
    console.log("API connection successful");
  } catch (error) {
    console.error("API connection test failed:", error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
    console.log("Please verify the API endpoint and authentication token");
  }
}

// Main execution with added API test
async function main() {
  try {
    // Test API connection first
    await testApiConnection();
    
    // Then proceed with database operations
    await createCollection();
    
    // Optional: Uncomment to reset database before loading
    // const resetResult = await deleteCollection();
    // if (resetResult) {
    //   await createCollection();
    // }
    
    await loadSampleData();
    await debugDbContents();
    console.log("Script completed successfully");
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

// Execute the main function
main();