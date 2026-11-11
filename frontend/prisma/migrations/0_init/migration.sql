-- Initial schema. Written to be safe on a fresh database AND on databases created before
-- Prisma (by the old Python backend or Better Auth's own migrator): every step is "if missing".

-- Login (Better Auth)
CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "session_token_key" ON "session"("token");
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");

-- Reports
CREATE TABLE IF NOT EXISTS "folders" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "screenshots" (
    "id" BIGSERIAL NOT NULL,
    "folder_id" BIGINT,
    "image_key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fields" JSONB,
    "report" TEXT,
    "error" TEXT,
    CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id")
);

-- Screenshots saved before folders existed move into "Unsorted".
ALTER TABLE "screenshots" ADD COLUMN IF NOT EXISTS "folder_id" BIGINT;
INSERT INTO "folders" ("name")
    SELECT 'Unsorted'
    WHERE EXISTS (SELECT 1 FROM "screenshots" WHERE "folder_id" IS NULL)
      AND NOT EXISTS (SELECT 1 FROM "folders" WHERE lower("name") = 'unsorted');
UPDATE "screenshots"
    SET "folder_id" = (SELECT "id" FROM "folders" WHERE lower("name") = 'unsorted' ORDER BY "id" LIMIT 1)
    WHERE "folder_id" IS NULL;
ALTER TABLE "screenshots" ALTER COLUMN "folder_id" SET NOT NULL;

-- The old backend indexed lower(name); Prisma manages a plain unique index under the same name.
DROP INDEX IF EXISTS "folders_name_key";
CREATE UNIQUE INDEX "folders_name_key" ON "folders"("name");
CREATE INDEX IF NOT EXISTS "screenshots_folder_created" ON "screenshots"("folder_id", "created_at");

-- Foreign keys (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_userId_fkey') THEN
        ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId")
            REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_userId_fkey') THEN
        ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId")
            REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'screenshots_folder_id_fkey') THEN
        ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_folder_id_fkey" FOREIGN KEY ("folder_id")
            REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
