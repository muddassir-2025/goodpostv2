import sharp from "sharp";

/**
 * Feed thumbnails.
 *
 * The feed renders images a few hundred pixels wide but was downloading the original
 * upload — a 4000px phone photo is several MB for a card that shows at ~600px. Generating
 * a resized WebP at upload time means the feed never pulls the full-size original.
 *
 * Thumbnails live at a derived key (`images/x.jpg` -> `images/x.thumb.webp`) so no schema
 * change is needed. Deriving the key must stay in sync with `thumbKey()` in storage.js and
 * `getFileUrl(..., { thumb: true })` on the client.
 */
const THUMB_WIDTH = 640;
const THUMB_QUALITY = 72;

/** Resize to feed width and encode as WebP. Returns null when sharp cannot read the input. */
export async function createThumbnail(buffer) {
  try {
    return await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate() // honour EXIF orientation before resizing
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();
  } catch (error) {
    // A thumbnail is an optimization, never a reason to fail the upload.
    console.error("createThumbnail error:", error.message);
    return null;
  }
}
