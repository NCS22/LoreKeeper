import { z } from "zod";

/**
 * The shape of what the sign-up action receives. Only the shape: every rule about the display
 * name, the email, the password and the repeat match belongs to the accounts domain (NFR-1).
 * A key that is not listed, such as a `userId`, is a validation failure.
 */
export const signUpInputSchema = z.strictObject({
  displayName: z.string(),
  email: z.string(),
  password: z.string(),
  repeatPassword: z.string(),
});
