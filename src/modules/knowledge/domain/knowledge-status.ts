export const KNOWLEDGE_STATUSES = ["CONFIRMED", "USER_NOTE", "SPECULATION"] as const;

/** Whether a piece of knowledge comes from the work, is the person's note or is a speculation. */
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const KNOWLEDGE_STATUS_INVALID_CODE = "STATUS_INVALID";

/**
 * Returns the status when the value is exactly one of the known statuses, otherwise `null`. There
 * is no default: a missing status is refused like an unknown one (FR-5, FR-7).
 */
export function parseKnowledgeStatus(value: unknown): KnowledgeStatus | null {
  return KNOWLEDGE_STATUSES.find((status) => status === value) ?? null;
}
