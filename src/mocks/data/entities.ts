import { CHARACTER_RECORDS } from "@/mocks/data/characters";
import type { EntityRecord } from "@/mocks/data/entity-records";
import { PLACE_AND_GROUP_RECORDS } from "@/mocks/data/places-and-groups";
import { THING_AND_IDEA_RECORDS } from "@/mocks/data/things-and-ideas";
import { TIDEWRACK_RECORDS } from "@/mocks/data/tidewrack";

export const ENTITY_RECORDS: readonly EntityRecord[] = [
  ...CHARACTER_RECORDS,
  ...PLACE_AND_GROUP_RECORDS,
  ...THING_AND_IDEA_RECORDS,
  ...TIDEWRACK_RECORDS,
];
