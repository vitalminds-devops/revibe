-- Pasted report text: an entry without an image.
ALTER TABLE "screenshots" ALTER COLUMN "image_key" DROP NOT NULL;
ALTER TABLE "screenshots" ADD COLUMN "text" TEXT;
