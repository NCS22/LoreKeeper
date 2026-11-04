import { CHARACTER_RECORDS } from "@/data/characters";
import type { EntityRecord } from "@/data/entity-records";
import { PLACE_AND_GROUP_RECORDS } from "@/data/places-and-groups";
import { THING_AND_IDEA_RECORDS } from "@/data/things-and-ideas";
import { TIDEWRACK_RECORDS } from "@/data/tidewrack";

export const ENTITY_RECORDS: readonly EntityRecord[] = [
  ...CHARACTER_RECORDS,
  ...PLACE_AND_GROUP_RECORDS,
  ...THING_AND_IDEA_RECORDS,
  ...TIDEWRACK_RECORDS,
];
