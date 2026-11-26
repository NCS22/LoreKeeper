import { z } from "zod";
import { isBlankFragmentContent } from "@/modules/knowledge";
import { boundaryInputSchema } from "./boundary-input-schema";

const firstFragmentInputSchema = z.object({
  content: z.string(),
  status: z.string().nullish(),
  boundary: boundaryInputSchema.nullish(),
});

/**
 * A fragment whose content is empty or only whitespace is no fragment (FR-5): it is dropped here,
 * before the shape of its status and boundary is checked, so whatever they hold is never read.
 * Anything else passes on unchanged, to be checked by the fragment schema.
 */
function dropBlankFragment(fragmentInput: unknown): unknown {
  if (
    typeof fragmentInput === "object" &&
    fragmentInput !== null &&
    "content" in fragmentInput &&
    typeof fragmentInput.content === "string" &&
    isBlankFragmentContent(fragmentInput.content)
  ) {
    return null;
  }
  return fragmentInput;
}

/**
 * The shape of what the create-entity action receives. Only the shape: the domain decides what a
 * valid name, type, status, identifier or unit number is. A key that is not listed, such as an
 * owner, attributes, a description or a unit identifier, is dropped without error (FR-4, NFR-2).
 */
export const createEntityInputSchema = z.object({
  universeId: z.string(),
  name: z.string(),
  type: z.string(),
  boundary: boundaryInputSchema,
  fragment: z.preprocess(dropBlankFragment, firstFragmentInputSchema.nullish()),
});
