import { InfrastructureError } from "@/shared/domain/error-kinds";

/**
 * Runs one storage operation. Any failure becomes an `InfrastructureError` with a generic
 * message; the original failure travels in `cause`, for the log only.
 */
export async function runUniverseStorageOperation<Result>(
  operationDescription: string,
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (failure) {
    if (failure instanceof InfrastructureError) {
      throw failure;
    }
    throw new InfrastructureError(`The universe storage failed while trying to ${operationDescription}.`, {
      cause: failure,
    });
  }
}
