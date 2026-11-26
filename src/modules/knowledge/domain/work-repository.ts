import type { ViewerContext } from "@/shared/domain/viewer-context";
import type { NewWork, Work } from "./work";

/**
 * Storage port for works and their units. Callers check the ownership of the universe first (the
 * read methods receive the `ViewerContext` that is built only after that check); every method is
 * limited to the one universe it is given and never reads another universe's works.
 */
export type WorkRepository = {
  /**
   * Stores the work together with all its units, all or nothing: when a unit cannot be stored, the
   * work is not stored either. Other works are not changed.
   */
  add(newWork: NewWork): Promise<void>;
  /**
   * Every work of the universe of the context that is not deleted, oldest first; works created at
   * the same instant are ordered by identifier ascending. Each work carries its number of units.
   */
  findAllInUniverse(viewerContext: ViewerContext): Promise<readonly Work[]>;
};
