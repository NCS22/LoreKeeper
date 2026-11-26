import type { ViewerContext } from "@/shared/domain/viewer-context";
import type { WorkRepository } from "../domain/work-repository";
import { toWorkDto, type WorkDto } from "./work-dto";

export type ListWorksDependencies = {
  readonly workRepository: WorkRepository;
};

/**
 * The works of the universe of the context, in creation order (ties by identifier), each with its
 * title, medium, unit wording and number of units (FR-2). The context exists only after the
 * ownership check, so the universe is always an own universe of the viewer.
 *
 * Temporary exception of spec 006 (2026-11-25): no visibility rule is applied; works and units are
 * structure and stay visible in the final design as well.
 */
export async function listWorks(
  dependencies: ListWorksDependencies,
  viewerContext: ViewerContext,
): Promise<readonly WorkDto[]> {
  const works = await dependencies.workRepository.findAllInUniverse(viewerContext);
  return works.map(toWorkDto);
}
