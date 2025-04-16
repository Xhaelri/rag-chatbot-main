// lib/extract-craftsman-data.ts

interface Craftsman {
    id: string;
    name: string;
    craft: string;
    rating?: number;
    reviewCount?: number;
    address?: string;
    description?: string;
    status?: string;
  }
  
  /**
   * Check if a message contains craftsman data from the knowledge base
   * @param text The message text
   */
  export function messageContainsCraftsmanData(text: string): boolean {
    // Look for document markers used in the context retrieval
    return text.includes("--- المستند") && text.includes("اسم الحرفي:");
  }
  
  /**
   * Extract craftsman data from AI message text
   * @param text The message text containing craftsman information
   */
  export function extractCraftsmanData(text: string): Craftsman[] {
    const craftsmen: Craftsman[] = [];
    
    // Find all document sections
    const documentRegex = /--- المستند \d+:[\s\S]*?--- نهاية المستند \d+ ---/g;
    const documents = text.match(documentRegex);
    
    if (!documents) return craftsmen;
    
    documents.forEach(docText => {
      try {
        // Extract name
        const nameMatch = docText.match(/اسم الحرفي: (.+?)(?:\n|$)/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        
        // Extract craft
        const craftMatch = docText.match(/المهنة: (.+?)(?:\n|$)/);
        const craft = craftMatch ? craftMatch[1].trim() : '';
        
        // Extract address
        const addressMatch = docText.match(/العنوان: (.+?)(?:\n|$)/);
        const address = addressMatch ? addressMatch[1].trim() : '';
        
        // Extract rating
        const ratingMatch = docText.match(/التقييم: ([0-9.]+)/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;
        
        // Extract number of ratings
        const reviewCountMatch = docText.match(/عدد التقييمات: ([0-9]+)/);
        const reviewCount = reviewCountMatch ? parseInt(reviewCountMatch[1]) : undefined;
        
        // Extract description
        const descriptionMatch = docText.match(/الوصف: (.+?)(?:\n|$)/);
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';
        
        // Extract status
        const statusMatch = docText.match(/الحالة: (.+?)(?:\n|$)/);
        const status = statusMatch ? 
          (statusMatch[1].includes('متاح') ? 'free' : 'busy') : 'free';
        
        // Extract ID from document or fallback to generating one
        // First try to extract from raw data if available
        const sourceIdMatch = docText.match(/sourceId: (\d+)/);
        const id = sourceIdMatch ? sourceIdMatch[1] : `craftsman-${craftsmen.length + 1}`;
        
        // Only add if we have at least name and craft
        if (name && craft) {
          craftsmen.push({
            id,
            name,
            craft,
            rating,
            reviewCount,
            address,
            description,
            status
          });
        }
      } catch (error) {
        console.error("Error parsing craftsman data:", error);
      }
    });
    
    return craftsmen;
  }
