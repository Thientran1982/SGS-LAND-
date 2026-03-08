import { db } from './dbApi';

// Simulated Vector Database (In-Memory)
// In a real production environment, this would be Pinecone, pgvector, or Milvus.

export interface VectorDocument {
    id: string;
    text: string;
    metadata?: any;
    embedding?: number[];
}

class VectorStore {
    private documents: VectorDocument[] = [];
    private isSynced: boolean = false;

    constructor() {
    }

    /**
     * Generate embeddings for a given text using Gemini's text-embedding model.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const response = await fetch('/api/ai/embed-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    text,
                    model: 'text-embedding-004'
                })
            });
            if (response.status === 401 || response.status === 403) {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('sgs_session_token');
                    window.location.href = '/login';
                }
                throw new Error('Authentication required');
            }
            if (!response.ok) throw new Error('Failed to generate embedding');
            const data = await response.json();
            return data.embeddings || [];
        } catch (error) {
            console.error("Error generating embedding:", error);
            return [];
        }
    }

    /**
     * Sync listings from the mock database into the vector store.
     */
    async syncListings() {
        if (this.isSynced) return;
        
        console.log("[VectorStore] Syncing listings for semantic search...");
        const listingsResponse = await db.getListings(1, 10);
        
        // Take a small sample to avoid hitting rate limits during mock initialization
        const sampleListings = listingsResponse.data; 
        
        const docs: VectorDocument[] = sampleListings.map(l => ({
            id: l.id,
            text: `Dự án: ${l.title}. Vị trí: ${l.location}. Loại: ${l.type}. Giá: ${l.price} VNĐ. Diện tích: ${l.area}m2. Đặc điểm: ${JSON.stringify(l.attributes)}`,
            metadata: { ...l }
        }));

        await this.addDocuments(docs);
        this.isSynced = true;
        console.log(`[VectorStore] Synced ${docs.length} listings.`);
    }

    /**
     * Add documents to the vector store. Generates embeddings if not provided.
     */
    async addDocuments(docs: VectorDocument[]) {
        for (const doc of docs) {
            if (!doc.embedding || doc.embedding.length === 0) {
                doc.embedding = await this.generateEmbedding(doc.text);
            }
            // Update if exists, else push
            const existingIndex = this.documents.findIndex(d => d.id === doc.id);
            if (existingIndex >= 0) {
                this.documents[existingIndex] = doc;
            } else {
                this.documents.push(doc);
            }
        }
    }

    /**
     * Calculate Cosine Similarity between two vectors.
     */
    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length || vecA.length === 0) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Perform Semantic Search (RAG) to find top-k similar documents.
     */
    async similaritySearch(query: string, k: number = 3): Promise<{ document: VectorDocument, score: number }[]> {
        const queryEmbedding = await this.generateEmbedding(query);
        if (queryEmbedding.length === 0) return [];

        const results = this.documents.map(doc => {
            const score = doc.embedding ? this.cosineSimilarity(queryEmbedding, doc.embedding) : 0;
            return { document: doc, score };
        });

        // Sort by highest similarity score
        results.sort((a, b) => b.score - a.score);

        return results.slice(0, k);
    }
    
    /**
     * Clear the vector store
     */
    clear() {
        this.documents = [];
    }
}

export const vectorStore = new VectorStore();
