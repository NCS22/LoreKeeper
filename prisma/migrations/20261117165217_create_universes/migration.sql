-- CreateEnum
CREATE TYPE "UniverseMode" AS ENUM ('READER', 'AUTHOR');

-- CreateTable
CREATE TABLE "Universe" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" "UniverseMode" NOT NULL DEFAULT 'READER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Universe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RememberedUniverse" (
    "userId" UUID NOT NULL,
    "universeId" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RememberedUniverse_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Universe_ownerId_createdAt_id_idx" ON "Universe"("ownerId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Universe_id_ownerId_key" ON "Universe"("id", "ownerId");

-- AddForeignKey
ALTER TABLE "Universe" ADD CONSTRAINT "Universe_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RememberedUniverse" ADD CONSTRAINT "RememberedUniverse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RememberedUniverse" ADD CONSTRAINT "RememberedUniverse_universeId_userId_fkey" FOREIGN KEY ("universeId", "userId") REFERENCES "Universe"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-added: lengths in code points, the same unit as the domain (specs/004-stored-universes/plan.md, section 2).
-- A description is either absent or has between 1 and 2000 characters.
ALTER TABLE "Universe" ADD CONSTRAINT "Universe_name_length_check" CHECK (char_length("name") BETWEEN 1 AND 120);
ALTER TABLE "Universe" ADD CONSTRAINT "Universe_description_length_check" CHECK ("description" IS NULL OR char_length("description") BETWEEN 1 AND 2000);
