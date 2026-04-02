
/**
 * Cleans AI-generated text by removing redundant Markdown characters
 * like asterisks (*), underscores (_), and extra whitespace.
 * This ensures a cleaner look for enterprise UIs where raw Markdown
 * might look like "slop".
 */
export const cleanAiResponse = (text: string): string => {
    if (!text) return "";
    
    return text
        // Remove bold/italic markers (double or single asterisks/underscores)
        // We keep the text inside them
        .replace(/(\*\*|__)(.*?)\1/g, "$2")
        .replace(/(\*|_)(.*?)\1/g, "$2")
        
        // Remove leading asterisks from bullet points if they are just used for emphasis
        // e.g., "* Nhu cầu: ..." -> "Nhu cầu: ..."
        .replace(/^\s*[\*\-]\s+/gm, "• ")
        
        // Remove any remaining stray asterisks that aren't part of a list
        .replace(/(?<!\w)\*(?!\w)/g, "")
        
        // Clean up multiple spaces and newlines
        .replace(/[ ]{2,}/g, " ")
        .trim();
};

/**
 * Executes an async function with Exponential Backoff retry logic.
 * Useful for handling rate limits (429) or temporary network failures with AI APIs.
 * 
 * @param fn The async function to execute
 * @param maxRetries Maximum number of retries
 * @param baseDelayMs Base delay in milliseconds
 * @returns The result of the function
 */
export const withRetry = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
): Promise<T> => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await fn();
        } catch (error: any) {
            attempt++;
            console.warn(`[Retry Mechanism] Attempt ${attempt} failed:`, error.message);
            
            if (attempt >= maxRetries) {
                console.error(`[Retry Mechanism] Max retries (${maxRetries}) reached. Throwing error.`);
                throw error;
            }
            
            // Exponential backoff: baseDelay * 2^attempt + random jitter
            const jitter = Math.random() * 200;
            const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error("Unreachable");
};

