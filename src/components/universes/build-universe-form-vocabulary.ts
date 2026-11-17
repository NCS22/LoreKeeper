import {
  DEFAULT_UNIVERSE_MODE,
  UNIVERSE_DESCRIPTION_FIELD,
  UNIVERSE_DESCRIPTION_INVALID_CHARACTERS_CODE,
  UNIVERSE_DESCRIPTION_TOO_LONG_CODE,
  UNIVERSE_MODE_FIELD,
  UNIVERSE_MODE_INVALID_CODE,
  UNIVERSE_MODES,
  UNIVERSE_NAME_FIELD,
  UNIVERSE_NAME_INVALID_CHARACTERS_CODE,
  UNIVERSE_NAME_REQUIRED_CODE,
  UNIVERSE_NAME_TOO_LONG_CODE,
} from "@/modules/universes";
import type { UniverseFormVocabulary } from "@/components/universes/universe-form-vocabulary";

/**
 * SERVER ONLY. Reads the field names, issue codes and modes of the universes module, to be passed
 * as a prop to the creation form. A client component must never import this file: the universes
 * module also exports server-only wiring, and the production build fails if it does.
 */
export function buildUniverseFormVocabulary(): UniverseFormVocabulary {
  return {
    fieldNames: {
      name: UNIVERSE_NAME_FIELD,
      description: UNIVERSE_DESCRIPTION_FIELD,
      mode: UNIVERSE_MODE_FIELD,
    },
    issueCodes: {
      nameRequired: UNIVERSE_NAME_REQUIRED_CODE,
      nameTooLong: UNIVERSE_NAME_TOO_LONG_CODE,
      nameInvalidCharacters: UNIVERSE_NAME_INVALID_CHARACTERS_CODE,
      descriptionTooLong: UNIVERSE_DESCRIPTION_TOO_LONG_CODE,
      descriptionInvalidCharacters: UNIVERSE_DESCRIPTION_INVALID_CHARACTERS_CODE,
      modeInvalid: UNIVERSE_MODE_INVALID_CODE,
    },
    modes: UNIVERSE_MODES,
    defaultMode: DEFAULT_UNIVERSE_MODE,
  };
}
