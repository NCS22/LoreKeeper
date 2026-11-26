import { InfrastructureError } from "@/shared/domain/error-kinds";

/**
 * Runs one storage operation of the knowledge module. Any failure becomes an `InfrastructureError`
 * with a generic message; the original failure travels in `cause`, for the log only.
 */
export async function runKnowledgeStorageOperation<Result>(
  operationDescription: string,
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (failure) {
    throw new InfrastructureError(
      `The knowledge storage failed while trying to ${operationDescription}.`,
      { cause: failure },
    );
  }
}
