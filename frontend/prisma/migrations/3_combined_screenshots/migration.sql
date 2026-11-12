-- More screenshots of the same long message, in reading order after image_key.
ALTER TABLE "screenshots" ADD COLUMN "extra_image_keys" JSONB;
