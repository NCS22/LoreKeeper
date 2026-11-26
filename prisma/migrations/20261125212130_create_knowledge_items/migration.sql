-- CreateEnum
CREATE TYPE "WorkMedium" AS ENUM ('NOVEL', 'MANGA', 'COMIC', 'ANIME', 'TV_SERIES', 'FILM', 'OTHER');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('CHARACTER', 'LOCATION', 'ORGANIZATION', 'FACTION', 'OBJECT', 'ABILITY', 'SPECIES', 'CONCEPT');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('CONFIRMED', 'USER_NOTE', 'SPECULATION');

-- CreateTable
CREATE TABLE "RelationshipType" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "universeId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "inverseLabel" TEXT NOT NULL,
    "isSymmetric" BOOLEAN NOT NULL,
    "isPredefined" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RelationshipType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "universeId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "medium" "WorkMedium" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeUnit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "NarrativeUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "universeId" UUID NOT NULL,
    "type" "EntityType" NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "boundaryWorkId" UUID NOT NULL,
    "boundaryUnitId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "universeId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "status" "KnowledgeStatus" NOT NULL,
    "boundaryWorkId" UUID NOT NULL,
    "boundaryUnitId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "universeId" UUID NOT NULL,
    "relationshipTypeId" UUID NOT NULL,
    "sourceEntityId" UUID NOT NULL,
    "targetEntityId" UUID NOT NULL,
    "status" "KnowledgeStatus" NOT NULL,
    "boundaryWorkId" UUID NOT NULL,
    "boundaryUnitId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelationshipType_id_universeId_key" ON "RelationshipType"("id", "universeId");

-- CreateIndex
CREATE INDEX "Work_universeId_createdAt_id_idx" ON "Work"("universeId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Work_id_universeId_key" ON "Work"("id", "universeId");

-- CreateIndex
CREATE INDEX "NarrativeUnit_workId_label_idx" ON "NarrativeUnit"("workId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeUnit_workId_ordinal_key" ON "NarrativeUnit"("workId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeUnit_id_workId_key" ON "NarrativeUnit"("id", "workId");

-- CreateIndex
CREATE INDEX "Entity_universeId_createdAt_id_idx" ON "Entity"("universeId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Entity_universeId_type_normalizedName_idx" ON "Entity"("universeId", "type", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_id_universeId_key" ON "Entity"("id", "universeId");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_entityId_createdAt_id_idx" ON "KnowledgeEntry"("entityId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Relationship_universeId_sourceEntityId_idx" ON "Relationship"("universeId", "sourceEntityId");

-- CreateIndex
CREATE INDEX "Relationship_universeId_targetEntityId_idx" ON "Relationship"("universeId", "targetEntityId");

-- AddForeignKey
ALTER TABLE "RelationshipType" ADD CONSTRAINT "RelationshipType_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeUnit" ADD CONSTRAINT "NarrativeUnit_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_boundaryWorkId_universeId_fkey" FOREIGN KEY ("boundaryWorkId", "universeId") REFERENCES "Work"("id", "universeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_boundaryUnitId_boundaryWorkId_fkey" FOREIGN KEY ("boundaryUnitId", "boundaryWorkId") REFERENCES "NarrativeUnit"("id", "workId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_entityId_universeId_fkey" FOREIGN KEY ("entityId", "universeId") REFERENCES "Entity"("id", "universeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_boundaryWorkId_universeId_fkey" FOREIGN KEY ("boundaryWorkId", "universeId") REFERENCES "Work"("id", "universeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_boundaryUnitId_boundaryWorkId_fkey" FOREIGN KEY ("boundaryUnitId", "boundaryWorkId") REFERENCES "NarrativeUnit"("id", "workId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_relationshipTypeId_universeId_fkey" FOREIGN KEY ("relationshipTypeId", "universeId") REFERENCES "RelationshipType"("id", "universeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_sourceEntityId_universeId_fkey" FOREIGN KEY ("sourceEntityId", "universeId") REFERENCES "Entity"("id", "universeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_targetEntityId_universeId_fkey" FOREIGN KEY ("targetEntityId", "universeId") REFERENCES "Entity"("id", "universeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_boundaryWorkId_universeId_fkey" FOREIGN KEY ("boundaryWorkId", "universeId") REFERENCES "Work"("id", "universeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_boundaryUnitId_boundaryWorkId_fkey" FOREIGN KEY ("boundaryUnitId", "boundaryWorkId") REFERENCES "NarrativeUnit"("id", "workId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-added (specs/006-knowledge-items/plan.md, section 2).
-- No second copy of a relationship type in a universe: the key is unique among the types that are not deleted.
CREATE UNIQUE INDEX "RelationshipType_universeId_key_not_deleted_key" ON "RelationshipType"("universeId", "key") WHERE "deletedAt" IS NULL;

-- Lengths in code points, the same unit as the domain.
ALTER TABLE "Work" ADD CONSTRAINT "Work_title_length_check" CHECK (char_length("title") BETWEEN 1 AND 200);
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_name_length_check" CHECK (char_length("name") BETWEEN 1 AND 120);
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_content_length_check" CHECK (char_length("content") BETWEEN 1 AND 5000);

-- A relationship never goes from an entity to itself.
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_source_is_not_target_check" CHECK ("sourceEntityId" <> "targetEntityId");

-- BEGIN predefined relationship types backfill
-- Every universe stored before this migration gets the eight predefined relationship types. The same list
-- lives in src/modules/universes/domain/predefined-relationship-types.ts, which new universes use; a
-- database test runs this block and pins both to the same list. Running it again adds no second copy.
INSERT INTO "RelationshipType" ("universeId", "key", "label", "inverseLabel", "isSymmetric", "isPredefined")
SELECT "Universe"."id", "PredefinedType"."key", "PredefinedType"."label", "PredefinedType"."inverseLabel", "PredefinedType"."isSymmetric", TRUE
FROM "Universe"
CROSS JOIN (
    VALUES
        ('MEMBER_OF', 'member of', 'has member', FALSE),
        ('LEADER_OF', 'leader of', 'led by', FALSE),
        ('ALLY_OF', 'ally of', 'ally of', TRUE),
        ('ENEMY_OF', 'enemy of', 'enemy of', TRUE),
        ('PARENT_OF', 'parent of', 'child of', FALSE),
        ('SIBLING_OF', 'sibling of', 'sibling of', TRUE),
        ('LOCATED_IN', 'located in', 'contains', FALSE),
        ('POSSESSES', 'possesses', 'possessed by', FALSE)
) AS "PredefinedType"("key", "label", "inverseLabel", "isSymmetric")
ON CONFLICT DO NOTHING;
-- END predefined relationship types backfill
