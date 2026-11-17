import type { ActingUser } from "@/shared/domain/acting-user";

export const FIRST_OWNER_ID = "10000000-0000-4000-8000-000000000001";
export const SECOND_OWNER_ID = "10000000-0000-4000-8000-000000000002";

export function buildActingUser(userId: string = FIRST_OWNER_ID): ActingUser {
  return { userId, displayName: "Test person", email: `${userId}@example.com` };
}
