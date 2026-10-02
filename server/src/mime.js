// Content sniffing: never trust the browser-supplied Content-Type.
// We check magic bytes so a renamed executable can't masquerade as an image.

function startsWith(buffer, bytes, offset = 0) {
  if (!buffer || buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

const ascii = (buffer, offset, length) =>
  buffer.toString("latin1", offset, offset + length);

/** Collapse equivalent MIME spellings so a declared type can be compared to a sniffed one. */
export function normalizeMime(mime = "") {
  const value = mime.toLowerCase().split(";")[0].trim();
  const aliases = {
    "audio/mp3": "audio/mpeg",
    "audio/m4a": "audio/mp4",
    "audio/x-m4a": "audio/mp4",
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "image/jpg": "image/jpeg",
  };
  return aliases[value] || value;
}

/** Returns the detected MIME type from magic bytes, or null when unrecognized. */
export function sniffMime(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // --- images ---
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(buffer, 0, 4) === "GIF8") return "image/gif";
  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 4) === "WEBP") return "image/webp";

  // --- audio ---
  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 4) === "WAVE") return "audio/wav";
  if (ascii(buffer, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(buffer, 0, 3) === "ID3") return "audio/mpeg";
  // MPEG audio frame sync: 11 set bits.
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "audio/mpeg";
  // ADTS AAC frame sync (checked after MPEG because the masks overlap).
  if (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) return "audio/aac";

  // --- Matroska / WebM (EBML) ---
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return "audio/webm";

  // --- ISO base media (MP4 / M4A / AVIF) ---
  if (ascii(buffer, 4, 4) === "ftyp") {
    const brand = ascii(buffer, 8, 4);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand.startsWith("M4A") || brand === "mp42" || brand === "mp41" || brand === "isom") {
      return "audio/mp4";
    }
  }

  return null;
}

/**
 * True when the declared type matches what the bytes actually are.
 * Both sides are normalized, so `audio/mp3` and `audio/mpeg` compare equal.
 */
export function mimeMatches(declared, buffer) {
  const detected = sniffMime(buffer);
  if (!detected) return { ok: false, detected: null, reason: "Unrecognized file format" };
  if (normalizeMime(declared) !== normalizeMime(detected)) {
    return {
      ok: false,
      detected,
      reason: `File contents (${detected}) do not match the declared type (${declared})`,
    };
  }
  return { ok: true, detected };
}
