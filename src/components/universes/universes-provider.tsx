"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUniversesInMemory,
  type CreateUniverseCommand,
  type UniverseDto,
} from "@/modules/universes";
import { getUniverses } from "@/mocks/data/queries";

// TEMPORARY adapter. It is the only place that knows universes are kept in memory in the
// browser. It is replaced by server reads and a Server Action when real storage arrives.

const SAMPLE_UNIVERSES: readonly UniverseDto[] = getUniverses().map((sampleUniverse) => ({
  id: sampleUniverse.id,
  name: sampleUniverse.name,
  description: sampleUniverse.description,
  mode: sampleUniverse.mode,
  createdAt: sampleUniverse.createdAt,
  updatedAt: sampleUniverse.updatedAt,
}));

type UniversesContextValue = {
  // Render cache of the repository, refreshed after every write.
  universes: readonly UniverseDto[];
  createUniverse: (command: CreateUniverseCommand) => Promise<UniverseDto>;
  isUniverseNameInUse: (name: string) => Promise<boolean>;
};

const UniversesContext = createContext<UniversesContextValue | null>(null);

export function UniversesProvider({ children }: { children: ReactNode }) {
  // Created once per mounted workspace; a reload starts again from the sample universes (FR-24).
  const [universesModule] = useState(() => createUniversesInMemory(SAMPLE_UNIVERSES));
  const [universes, setUniverses] = useState<readonly UniverseDto[]>(SAMPLE_UNIVERSES);

  const createUniverse = useCallback(
    async (command: CreateUniverseCommand) => {
      const createdUniverse = await universesModule.createUniverse(command);
      setUniverses(await universesModule.listUniverses());
      return createdUniverse;
    },
    [universesModule],
  );

  const contextValue = useMemo(
    () => ({
      universes,
      createUniverse,
      isUniverseNameInUse: universesModule.isUniverseNameInUse,
    }),
    [universes, createUniverse, universesModule],
  );

  return <UniversesContext.Provider value={contextValue}>{children}</UniversesContext.Provider>;
}

export function useUniverses(): UniversesContextValue {
  const contextValue = useContext(UniversesContext);
  if (contextValue === null) {
    throw new Error("useUniverses must be used inside UniversesProvider");
  }
  return contextValue;
}
