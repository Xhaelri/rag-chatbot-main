// lib/extract-craftsman-data.ts

// Define the structure, including potentially missing fields from logs
interface Craftsman {
    id: string;
    name: string;
    craft: string;
    rating?: number;
    reviewCount?: number;
    address?: string; // Can be combination of العنوان and المدن
    description?: string;
    status?: string;
    // Add other potential fields if your card uses them
    cities?: string;
    completedJobs?: number; // from الوظائف المنجزة
    activeJobs?: number; // from الوظائف النشطة
}

/**
 * Check if a message contains craftsman data markers
 * @param text The message text
 */
export function messageContainsCraftsmanData(text: string): boolean {
    // Simple check for start marker and essential sourceId marker
    return text.includes("--- المستند") && text.includes("sourceId:");
}

/**
 * Extract craftsman data from AI message text, handling run-on fields.
 * @param text The message text containing craftsman information
 */
export function extractCraftsmanData(text: string): Craftsman[] {
    const craftsmen: Craftsman[] = [];

    // Regex to find document blocks reliably
    const documentRegex = /--- المستند \d+.*?([\s\S]*?)--- نهاية المستند \d+ ---/g;
    let match;

    while ((match = documentRegex.exec(text)) !== null) {
        // Use group 1 which captures content *between* the start/end markers
        const docContent = match[1];
        if (!docContent || !docContent.trim()) {
            console.warn("Skipping empty document block");
            continue;
        }

        try {
            // Define field labels in the likely order they appear in the text
            const fields = [
                { key: 'name', label: 'اسم الحرفي:' },
                { key: 'craft', label: 'المهنة:' },
                { key: 'addressRaw', label: 'العنوان:' }, // Raw address field
                { key: 'cities', label: 'المدن:' },
                { key: 'ratingText', label: 'التقييم:' }, // Raw rating text
                { key: 'completedJobsText', label: 'الوظائف المنجزة:' },
                { key: 'activeJobsText', label: 'الوظائف النشطة:' },
                { key: 'description', label: 'الوصف:' },
                { key: 'statusText', label: 'الحالة:' }, // Raw status text
                { key: 'sourceId', label: 'sourceId:' }, // Must be last searchable field before end marker
            ];

            // Store extracted raw values temporarily
            const extractedRawData: Record<string, string> = {};
            let currentPos = 0;

            // Find the start of the first label
            const firstLabelPos = docContent.indexOf(fields[0].label);
            if (firstLabelPos === -1) {
                 console.warn("Could not find the first label 'اسم الحرفي:' in doc:", docContent);
                 continue; // Skip doc if essential first label is missing
            }
            currentPos = firstLabelPos;


            for (let i = 0; i < fields.length; i++) {
                const currentField = fields[i];
                const nextFieldLabel = (i + 1 < fields.length) ? fields[i + 1].label : null;

                // Find current label starting from currentPos
                const labelPos = docContent.indexOf(currentField.label, currentPos);

                // This check might be redundant if firstLabelPos worked, but safe
                if (labelPos === -1) {
                    // console.log(`Label '${currentField.label}' not found after pos ${currentPos}.`);
                    continue; // Skip if this specific label isn't found from current position
                }


                const valueStartPos = labelPos + currentField.label.length;
                let valueEndPos = docContent.length; // Default to end of content

                // Find the start of the *next* known label to determine the end of the current value
                if (nextFieldLabel) {
                    const nextLabelPos = docContent.indexOf(nextFieldLabel, valueStartPos);
                    if (nextLabelPos !== -1) {
                        valueEndPos = nextLabelPos; // End before the next label starts
                    }
                    // If next label isn't found, valueEndPos remains docContent.length
                }

                const rawValue = docContent.substring(valueStartPos, valueEndPos).trim();
                if (rawValue) { // Only store if there's a value
                    extractedRawData[currentField.key] = rawValue;
                }

                // Update current position for the next search to start *after* this label
                currentPos = valueStartPos; // Start next search after current label's value starts
            }

            // --- Post-process extracted raw values ---

            // ID is crucial
            const id = extractedRawData.sourceId || `fallback-${Date.now()}-${craftsmen.length}`;

            // Name and Craft (essential)
            const name = extractedRawData.name || '';
            const craft = extractedRawData.craft || '';

            if (!name || !craft) {
                console.warn("Skipping document block due to missing name or craft. Raw data:", extractedRawData);
                continue; // Skip if essential info missing
            }

            // Rating and Review Count (handle combined text and edge cases)
            let rating: number | undefined = undefined;
            let reviewCount: number | undefined = undefined;
            const ratingText = extractedRawData.ratingText;
            if (ratingText) {
                if (ratingText.includes("غير متوفر")) {
                    rating = undefined;
                    reviewCount = 0;
                } else {
                    const ratingValMatch = ratingText.match(/^([0-9.]+)/); // Number at start
                    if (ratingValMatch) {
                        rating = parseFloat(ratingValMatch[1]);
                    }
                    // Try extracting count from different patterns
                    const reviewCountMatch = ratingText.match(/عدد التقييمات: ([0-9]+)/) ??
                                             ratingText.match(/\(([0-9]+)\)/) ?? // Look for count in parentheses (e.g., "4 (5)")
                                             ratingText.match(/\((\d+)\s*تقييمات?\)/); // E.g. "4 (5 تقييمات)"

                    if (reviewCountMatch && reviewCountMatch[1]) {
                        reviewCount = parseInt(reviewCountMatch[1], 10);
                    }
                }
            }

            // Status
            let status = 'free'; // Default to free
            const statusText = extractedRawData.statusText;
            if (statusText && statusText.includes('مشغول')) { // Check if 'busy' is mentioned
                 status = 'busy';
            }

            // Completed/Active Jobs
             const completedJobsText = extractedRawData.completedJobsText;
             const activeJobsText = extractedRawData.activeJobsText;
             const completedJobs = completedJobsText ? parseInt(completedJobsText, 10) : undefined;
             const activeJobs = activeJobsText ? parseInt(activeJobsText, 10) : undefined;


            // Combine Address and Cities for display simplicity
            const addressCombined = [extractedRawData.addressRaw, extractedRawData.cities]
                                      .filter(Boolean) // Remove null/undefined/empty
                                      .join(', '); // Combine with comma and space

            // Build the final object
            craftsmen.push({
                id,
                name,
                craft,
                address: addressCombined || undefined, // Use combined address, or undefined if both empty
                rating,
                reviewCount,
                description: extractedRawData.description || undefined,
                status,
                // Add other fields if needed by your CraftsmanCard component
                cities: extractedRawData.cities || undefined,
                completedJobs: !isNaN(completedJobs as number) ? completedJobs : undefined,
                activeJobs: !isNaN(activeJobs as number) ? activeJobs : undefined,
            });

        } catch (error) {
            console.error("Error parsing craftsman document block. Content:", docContent, "Error:", error);
        }
    } // end while loop scanning documents

    if (craftsmen.length === 0 && text.includes("--- المستند")) {
        console.warn("Detected document markers but failed to extract any craftsmen data.");
    }

    return craftsmen;
}