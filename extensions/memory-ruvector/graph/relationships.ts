/**
 * Automatic Relationship Inference for Knowledge Graph
 *
 * Provides entity extraction, relationship detection, and automatic linking
 * based on vector similarity. Integrates with hooks for automatic inference
 * on document indexing.
 *
 * Part of the P2 (Adaptive Loops) ruvLLM feature set.
 */

import type { PluginLogger } from "clawdbot/plugin-sdk";

import type { RuvectorClient } from "../client.js";
import type { RuvectorDB } from "../db.js";
import type { EmbeddingProvider } from "../embeddings.js";
import type { VectorEntry } from "../types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * An extracted entity from content.
 */
export type ExtractedEntity = {
  /** Entity text as found in content */
  text: string;
  /** Entity type/category */
  type: EntityType;
  /** Start position in content */
  startPos: number;
  /** End position in content */
  endPos: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Normalized form of the entity */
  normalized?: string;
};

/**
 * Entity types for classification.
 */
export type EntityType =
  | "person"
  | "organization"
  | "location"
  | "date"
  | "time"
  | "number"
  | "url"
  | "email"
  | "concept"
  | "action"
  | "object"
  | "unknown";

/**
 * An inferred relationship between entities or documents.
 */
export type InferredRelationship = {
  /** Source entity or document ID */
  sourceId: string;
  /** Source text (if entity) */
  sourceText?: string;
  /** Target entity or document ID */
  targetId: string;
  /** Target text (if entity) */
  targetText?: string;
  /** Relationship type */
  relationshipType: RelationshipType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Evidence/reason for this relationship */
  evidence?: string;
};

/**
 * Types of relationships that can be inferred.
 */
export type RelationshipType =
  | "MENTIONS"
  | "RELATED_TO"
  | "SIMILAR_TO"
  | "FOLLOWS"
  | "REFERENCES"
  | "CONTAINS"
  | "CAUSED_BY"
  | "AFFECTS"
  | "LOCATED_IN"
  | "BELONGS_TO"
  | "PART_OF"
  | "SAME_AS";

/**
 * Options for relationship inference.
 */
export type InferenceOptions = {
  /** Minimum similarity for auto-linking (default: 0.7) */
  similarityThreshold?: number;
  /** Maximum relationships to create per document (default: 10) */
  maxRelationships?: number;
  /** Entity types to extract (default: all) */
  entityTypes?: EntityType[];
  /** Whether to create bidirectional links (default: false) */
  bidirectional?: boolean;
};

/**
 * Result from inference operations.
 */
export type InferenceResult = {
  /** Entities extracted from content */
  entities: ExtractedEntity[];
  /** Relationships inferred */
  relationships: InferredRelationship[];
  /** Number of graph edges created */
  edgesCreated: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
};

// =============================================================================
// RelationshipInferrer Class
// =============================================================================

/**
 * Automatic relationship inference engine.
 *
 * Features:
 * - Entity extraction using pattern matching
 * - Relationship detection from content structure
 * - Automatic linking based on vector similarity
 * - Integration with hooks for on-index inference
 *
 * @example
 * ```typescript
 * const inferrer = new RelationshipInferrer({
 *   client,
 *   db,
 *   embeddings,
 *   logger,
 * });
 *
 * // Infer from new content
 * const result = await inferrer.inferFromContent(entry);
 *
 * // Auto-link by similarity
 * const links = await inferrer.linkSimilar(entryId, 0.8);
 * ```
 */
export class RelationshipInferrer {
  private readonly client: RuvectorClient;
  private readonly db: RuvectorDB;
  private readonly embeddings: EmbeddingProvider;
  private readonly logger: PluginLogger;

  // Entity extraction patterns
  private readonly patterns: Map<EntityType, RegExp[]> = new Map();

  constructor(options: {
    client: RuvectorClient;
    db: RuvectorDB;
    embeddings: EmbeddingProvider;
    logger: PluginLogger;
  }) {
    this.client = options.client;
    this.db = options.db;
    this.embeddings = options.embeddings;
    this.logger = options.logger;

    this.initializePatterns();
  }

  // ===========================================================================
  // Core Methods
  // ===========================================================================

  /**
   * Infer relationships from a document entry.
   *
   * This method:
   * 1. Extracts entities from the content
   * 2. Detects relationships between entities
   * 3. Creates graph edges for discovered relationships
   *
   * @param entry - The vector entry to analyze
   * @param options - Inference options
   * @returns Inference results including entities and relationships
   */
  async inferFromContent(
    entry: VectorEntry,
    options: InferenceOptions = {},
  ): Promise<InferenceResult> {
    const startTime = Date.now();
    const maxRelationships = options.maxRelationships ?? 10;

    try {
      const content = entry.metadata.text;
      if (!content || typeof content !== "string") {
        return {
          entities: [],
          relationships: [],
          edgesCreated: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Step 1: Extract entities from content
      const entities = this.extractEntities(content, options.entityTypes);

      // Step 2: Detect relationships between entities
      const entityRelationships = this.detectEntityRelationships(
        content,
        entities,
      );

      // Step 3: Create graph edges for entity relationships
      let edgesCreated = 0;
      for (const rel of entityRelationships.slice(0, maxRelationships)) {
        try {
          const created = await this.createRelationshipEdge(entry.id, rel);
          if (created) edgesCreated++;
        } catch (err) {
          this.logger.debug?.(
            `relationship-inferrer: failed to create edge: ${formatError(err)}`,
          );
        }
      }

      const result: InferenceResult = {
        entities,
        relationships: entityRelationships,
        edgesCreated,
        processingTimeMs: Date.now() - startTime,
      };

      this.logger.debug?.(
        `relationship-inferrer: inferred ${entities.length} entities, ` +
        `${entityRelationships.length} relationships from entry ${entry.id} ` +
        `(${result.processingTimeMs}ms)`,
      );

      return result;
    } catch (err) {
      this.logger.warn(
        `relationship-inferrer: inferFromContent failed: ${formatError(err)}`,
      );
      return {
        entities: [],
        relationships: [],
        edgesCreated: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Automatically link a document to similar documents by vector similarity.
   *
   * @param entryId - The document ID to find links for
   * @param threshold - Minimum similarity threshold (default: 0.7)
   * @returns Number of edges created
   */
  async linkSimilar(
    entryId: string,
    threshold?: number,
  ): Promise<number> {
    const similarityThreshold = threshold ?? 0.7;

    try {
      // Get the entry to link
      const entry = await this.client.get(entryId);
      if (!entry || entry.vector.length === 0) {
        this.logger.debug?.(
          `relationship-inferrer: entry ${entryId} not found or has no vector`,
        );
        return 0;
      }

      // Search for similar entries
      const searchResults = await this.client.search({
        vector: entry.vector,
        limit: 20,
        minScore: similarityThreshold,
      });

      let edgesCreated = 0;

      for (const result of searchResults) {
        // Skip self
        if (result.entry.id === entryId) continue;

        // Create SIMILAR_TO relationship
        try {
          const edgeId = await this.client.addEdge({
            sourceId: entryId,
            targetId: result.entry.id,
            relationship: "SIMILAR_TO",
            weight: result.score,
            properties: {
              similarity: result.score,
              createdAt: Date.now(),
              autoInferred: true,
            },
          });

          if (edgeId) {
            edgesCreated++;
          }
        } catch (err) {
          // Edge might already exist, which is fine
          this.logger.debug?.(
            `relationship-inferrer: edge creation skipped: ${formatError(err)}`,
          );
        }
      }

      this.logger.debug?.(
        `relationship-inferrer: created ${edgesCreated} similarity links for entry ${entryId}`,
      );

      return edgesCreated;
    } catch (err) {
      this.logger.warn(
        `relationship-inferrer: linkSimilar failed for ${entryId}: ${formatError(err)}`,
      );
      return 0;
    }
  }

  /**
   * Batch process documents for relationship inference.
   *
   * @param entries - Documents to process
   * @param options - Inference options
   * @returns Total edges created
   */
  async batchInfer(
    entries: VectorEntry[],
    options: InferenceOptions = {},
  ): Promise<number> {
    let totalEdges = 0;

    for (const entry of entries) {
      const result = await this.inferFromContent(entry, options);
      totalEdges += result.edgesCreated;

      // Also link by similarity if graph is initialized
      if (this.client.isGraphInitialized()) {
        const similarEdges = await this.linkSimilar(
          entry.id,
          options.similarityThreshold,
        );
        totalEdges += similarEdges;
      }
    }

    return totalEdges;
  }

  // ===========================================================================
  // Entity Extraction
  // ===========================================================================

  /**
   * Extract entities from text content.
   */
  extractEntities(
    content: string,
    filterTypes?: EntityType[],
  ): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const seenTexts = new Set<string>();

    for (const [type, patterns] of this.patterns.entries()) {
      // Skip types not in filter
      if (filterTypes && !filterTypes.includes(type)) continue;

      for (const pattern of patterns) {
        // Ensure global flag is set without duplicating it
        const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
        const regex = new RegExp(pattern.source, flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
          const text = match[0].trim();

          // Skip duplicates
          const key = `${type}:${text.toLowerCase()}`;
          if (seenTexts.has(key)) continue;
          seenTexts.add(key);

          // Skip very short or very long entities
          if (text.length < 2 || text.length > 100) continue;

          entities.push({
            text,
            type,
            startPos: match.index,
            endPos: match.index + match[0].length,
            confidence: this.calculateEntityConfidence(text, type),
            normalized: this.normalizeEntity(text, type),
          });
        }
      }
    }

    // Sort by position in text
    entities.sort((a, b) => a.startPos - b.startPos);

    return entities;
  }

  // ===========================================================================
  // Relationship Detection
  // ===========================================================================

  /**
   * Detect relationships between extracted entities.
   */
  private detectEntityRelationships(
    content: string,
    entities: ExtractedEntity[],
  ): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];

    // Co-occurrence based relationships
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const e1 = entities[i];
        const e2 = entities[j];

        // Check if entities are close in text (within 100 chars)
        const distance = e2.startPos - e1.endPos;
        if (distance > 0 && distance < 100) {
          const relType = this.inferRelationshipType(content, e1, e2);
          const confidence = this.calculateRelationshipConfidence(e1, e2, distance);

          if (confidence > 0.3) {
            relationships.push({
              sourceId: e1.normalized ?? e1.text,
              sourceText: e1.text,
              targetId: e2.normalized ?? e2.text,
              targetText: e2.text,
              relationshipType: relType,
              confidence,
              evidence: content.slice(
                Math.max(0, e1.startPos - 20),
                Math.min(content.length, e2.endPos + 20),
              ),
            });
          }
        }
      }
    }

    // Sort by confidence descending
    relationships.sort((a, b) => b.confidence - a.confidence);

    return relationships;
  }

  /**
   * Infer relationship type from context between two entities.
   */
  private inferRelationshipType(
    content: string,
    e1: ExtractedEntity,
    e2: ExtractedEntity,
  ): RelationshipType {
    const between = content.slice(e1.endPos, e2.startPos).toLowerCase();

    // Check for specific relationship indicators
    if (/\b(in|at|from|to)\b/.test(between) && e2.type === "location") {
      return "LOCATED_IN";
    }
    if (/\b(of|belongs to|part of|member of)\b/.test(between)) {
      return "BELONGS_TO";
    }
    if (/\b(contains|includes|has)\b/.test(between)) {
      return "CONTAINS";
    }
    if (/\b(causes|leads to|results in)\b/.test(between)) {
      return "CAUSED_BY";
    }
    if (/\b(affects|impacts|influences)\b/.test(between)) {
      return "AFFECTS";
    }
    if (/\b(mentions|refers to|about)\b/.test(between)) {
      return "MENTIONS";
    }
    if (/\b(same as|equals|is)\b/.test(between)) {
      return "SAME_AS";
    }

    // Default based on entity types
    if (e1.type === "person" && e2.type === "organization") {
      return "BELONGS_TO";
    }
    if (e1.type === "action" || e2.type === "action") {
      return "AFFECTS";
    }

    return "RELATED_TO";
  }

  /**
   * Calculate confidence for a relationship.
   */
  private calculateRelationshipConfidence(
    e1: ExtractedEntity,
    e2: ExtractedEntity,
    distance: number,
  ): number {
    // Start with base confidence from entity confidences
    let confidence = (e1.confidence + e2.confidence) / 2;

    // Reduce confidence for distant entities
    confidence *= Math.exp(-distance / 50);

    // Boost for certain entity type combinations
    if (
      (e1.type === "person" && e2.type === "organization") ||
      (e1.type === "person" && e2.type === "location") ||
      (e1.type === "concept" && e2.type === "action")
    ) {
      confidence *= 1.2;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Calculate confidence score for an extracted entity.
   */
  private calculateEntityConfidence(text: string, type: EntityType): number {
    let confidence = 0.5; // Base confidence

    // Boost for specific patterns
    switch (type) {
      case "email":
      case "url":
        confidence = 0.95; // High confidence for structural patterns
        break;
      case "date":
      case "time":
      case "number":
        confidence = 0.9;
        break;
      case "person":
        // Higher confidence for proper casing
        if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(text)) {
          confidence = 0.8;
        }
        break;
      case "organization":
        if (/\b(Inc|Corp|LLC|Ltd|Co)\b/i.test(text)) {
          confidence = 0.85;
        }
        break;
      default:
        confidence = 0.5;
    }

    // Reduce confidence for very short entities
    if (text.length < 4) {
      confidence *= 0.7;
    }

    return confidence;
  }

  /**
   * Normalize an entity to a canonical form.
   */
  private normalizeEntity(text: string, type: EntityType): string {
    switch (type) {
      case "email":
        return text.toLowerCase();
      case "url":
        return text.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      case "date":
        // Try to parse and format date
        try {
          const date = new Date(text);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split("T")[0];
          }
        } catch {
          // Keep original
        }
        return text;
      default:
        // Title case for names
        return text
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  // ===========================================================================
  // Graph Operations
  // ===========================================================================

  /**
   * Create a relationship edge in the graph.
   */
  private async createRelationshipEdge(
    documentId: string,
    relationship: InferredRelationship,
  ): Promise<boolean> {
    if (!this.client.isGraphInitialized()) {
      return false;
    }

    try {
      // Create edge from document to target entity
      await this.client.addEdge({
        sourceId: documentId,
        targetId: `entity:${relationship.targetId}`,
        relationship: relationship.relationshipType,
        weight: relationship.confidence,
        properties: {
          sourceText: relationship.sourceText,
          targetText: relationship.targetText,
          evidence: relationship.evidence,
          confidence: relationship.confidence,
          createdAt: Date.now(),
          autoInferred: true,
        },
      });

      return true;
    } catch (err) {
      this.logger.debug?.(
        `relationship-inferrer: failed to create edge: ${formatError(err)}`,
      );
      return false;
    }
  }

  // ===========================================================================
  // Pattern Initialization
  // ===========================================================================

  /**
   * Initialize entity extraction patterns.
   */
  private initializePatterns(): void {
    // Email pattern
    this.patterns.set("email", [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    ]);

    // URL pattern
    this.patterns.set("url", [
      /https?:\/\/[^\s<>"{}|\\^`[\]]+/i,
      /www\.[^\s<>"{}|\\^`[\]]+/i,
    ]);

    // Date patterns
    this.patterns.set("date", [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
      /\b\d{4}-\d{2}-\d{2}\b/,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s*\d{4}\b/i,
      /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i,
    ]);

    // Time patterns
    this.patterns.set("time", [
      /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/,
    ]);

    // Number patterns (currency, percentages, quantities)
    this.patterns.set("number", [
      /\$[\d,]+(?:\.\d{2})?/,
      /[\d,]+%/,
      /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:million|billion|thousand|hundred)\b/i,
    ]);

    // Person names (simple heuristic: Title Case words)
    this.patterns.set("person", [
      /\b(?:Mr|Mrs|Ms|Dr|Prof)\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/,
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/,
    ]);

    // Organization patterns
    this.patterns.set("organization", [
      /\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\s+(?:Inc|Corp|LLC|Ltd|Co|Company|Organization|Foundation|Institute)\b/,
      /\b(?:The\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+\b/,
    ]);

    // Location patterns
    this.patterns.set("location", [
      /\b(?:in|at|from|to)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/,
      /\b[A-Z][a-z]+,\s+[A-Z]{2}\b/, // City, State
    ]);

    // Concept patterns (abstract nouns, often quoted or emphasized)
    // Limit quoted strings to reasonable length (2-50 chars) to avoid noise
    this.patterns.set("concept", [
      /"[^"]{2,50}"/,
      /'[^']{2,50}'/,
      /\b[a-z]+(?:tion|ment|ness|ity|ism)\b/,
    ]);

    // Action patterns (verbs in gerund or infinitive form, with minimum length)
    // Require at least 5 characters to avoid matching common short words
    this.patterns.set("action", [
      /\b(?:to\s+)[a-z]{3,}(?:ing|ed|e)?\b/,
      /\b[a-z]{4,}(?:ing|ed)\b/,
    ]);
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format an error for logging.
 */
function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
