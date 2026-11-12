-- Archived folders are hidden from the main folder list.
ALTER TABLE "folders" ADD COLUMN "archived_at" TIMESTAMPTZ(6);
