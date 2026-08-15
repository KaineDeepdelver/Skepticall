package net.omnimedia.omni.media.util;

import org.apache.commons.imaging.formats.jpeg.exif.ExifRewriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.Locale;
import java.util.UUID;

/**
 * Strips privacy-sensitive metadata (GPS coordinates, camera/device model,
 * original timestamps, software tags, thumbnails, etc.) from user-uploaded
 * media before it's written to R2.
 *
 * This runs for every upload path that goes through R2StorageService —
 * avatars, banners, post media, message attachments, network icons/banners —
 * so nothing needs to change at individual call sites.
 *
 * Strategy per format:
 *   - JPEG: EXIF/APP1 segment is dropped via Apache Commons Imaging's
 *     ExifRewriter. This is a lossless, segment-level operation — no
 *     re-encoding of pixel data, so image quality is untouched.
 *   - PNG: ancillary metadata chunks (eXIf, tEXt, zTXt, iTXt, tIME) are
 *     stripped by walking the chunk stream directly. PNG's chunk format is
 *     simple enough that this doesn't need a library, and it's lossless
 *     for the same reason — pixel (IDAT) chunks are untouched.
 *   - WEBP: EXIF/XMP RIFF chunks are dropped by walking the RIFF container.
 *   - MP4/MOV/WEBM (video): handled by shelling out to ffmpeg with
 *     "-map_metadata -1 -c copy" (stream copy, so no re-encode/quality
 *     loss) IF ffmpeg is on the server's PATH. If ffmpeg isn't installed,
 *     the file is passed through unscrubbed and a warning is logged —
 *     video metadata stripping needs ffmpeg available in the deploy
 *     environment (e.g. installed via the Render build/Dockerfile).
 *   - Anything else (gif, unrecognized types): passed through unchanged.
 *
 * All failures are non-fatal: if scrubbing throws for any reason, the
 * original bytes are uploaded rather than blocking the user's upload.
 */
@Component
public class MediaMetadataScrubber {

    private static final Logger log = LoggerFactory.getLogger(MediaMetadataScrubber.class);

    /** Cached result of checking whether ffmpeg is on PATH. */
    private volatile Boolean ffmpegAvailable;

    public static class ScrubResult {
        public final byte[] bytes;
        public final String contentType;

        public ScrubResult(byte[] bytes, String contentType) {
            this.bytes = bytes;
            this.contentType = contentType;
        }
    }

    /**
     * Returns a metadata-scrubbed copy of the given file's bytes. Falls
     * back to the original bytes (best-effort, never throws) if the format
     * isn't recognized or scrubbing fails for any reason.
     */
    public ScrubResult scrub(byte[] original, String filename, String contentType) {
        String ext = extensionOf(filename, contentType);

        try {
            switch (ext) {
                case "jpg":
                case "jpeg":
                    return new ScrubResult(scrubJpeg(original), contentType);
                case "png":
                    return new ScrubResult(scrubPng(original), contentType);
                case "webp":
                    return new ScrubResult(scrubWebp(original), contentType);
                case "mp4":
                case "mov":
                case "m4v":
                case "webm":
                    return new ScrubResult(scrubVideo(original, ext), contentType);
                default:
                    return new ScrubResult(original, contentType);
            }
        } catch (Exception e) {
            log.warn("Metadata scrub failed for '{}' ({}), uploading original file unscrubbed: {}",
                    filename, ext, e.getMessage());
            return new ScrubResult(original, contentType);
        }
    }

    // ── JPEG ─────────────────────────────────────────────────────────────

    private byte[] scrubJpeg(byte[] original) throws IOException, org.apache.commons.imaging.ImagingException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(original.length);
        // removeExifMetadata drops the entire APP1/EXIF segment (GPS,
        // camera make/model, orientation, timestamps, thumbnail, etc.)
        // while leaving pixel data byte-for-byte untouched.
        new ExifRewriter().removeExifMetadata(original, out);
        return out.toByteArray();
    }

    // ── PNG ──────────────────────────────────────────────────────────────

    private static final byte[] PNG_SIGNATURE = {
            (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'
    };

    /** PNG ancillary chunk types that can carry metadata worth stripping. */
    private static final java.util.Set<String> PNG_METADATA_CHUNKS = java.util.Set.of(
            "eXIf", "tEXt", "zTXt", "iTXt", "tIME"
    );

    private byte[] scrubPng(byte[] original) throws IOException {
        if (original.length < 8 || !startsWith(original, PNG_SIGNATURE)) {
            return original; // not actually a PNG despite the extension
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream(original.length);
        out.write(original, 0, 8); // signature

        int pos = 8;
        while (pos + 8 <= original.length) {
            long length = readUInt32BE(original, pos);
            if (length < 0 || pos + 12 + length > original.length) break; // malformed, bail and keep signature+what we wrote
            String type = new String(original, pos + 4, 4, java.nio.charset.StandardCharsets.US_ASCII);
            int chunkTotalLen = (int) (12 + length); // length(4) + type(4) + data(length) + crc(4)

            if (!PNG_METADATA_CHUNKS.contains(type)) {
                out.write(original, pos, chunkTotalLen);
            }
            pos += chunkTotalLen;

            if ("IEND".equals(type)) break;
        }

        return out.size() > 8 ? out.toByteArray() : original;
    }

    // ── WEBP ─────────────────────────────────────────────────────────────

    private byte[] scrubWebp(byte[] original) throws IOException {
        // RIFF container: "RIFF" <size:4> "WEBP" then a sequence of
        // <fourcc:4><size:4><data:size (+1 pad byte if size is odd)> chunks.
        if (original.length < 12
                || original[0] != 'R' || original[1] != 'I' || original[2] != 'F' || original[3] != 'F'
                || original[8] != 'W' || original[9] != 'E' || original[10] != 'B' || original[11] != 'P') {
            return original;
        }

        ByteArrayOutputStream body = new ByteArrayOutputStream(original.length);
        int pos = 12;
        while (pos + 8 <= original.length) {
            String fourcc = new String(original, pos, 4, java.nio.charset.StandardCharsets.US_ASCII);
            long size = readUInt32LE(original, pos + 4);
            int padded = (int) (size + (size % 2));
            if (pos + 8 + padded > original.length) break;

            if (!"EXIF".equals(fourcc) && !"XMP ".equals(fourcc)) {
                body.write(original, pos, 8 + padded);
            }
            pos += 8 + padded;
        }

        byte[] bodyBytes = body.toByteArray();
        ByteArrayOutputStream out = new ByteArrayOutputStream(12 + bodyBytes.length);
        out.write(new byte[]{'R', 'I', 'F', 'F'}, 0, 4);
        writeUInt32LE(out, 4 + bodyBytes.length); // "WEBP" + chunks
        out.write(new byte[]{'W', 'E', 'B', 'P'}, 0, 4);
        out.write(bodyBytes, 0, bodyBytes.length);
        return out.toByteArray();
    }

    // ── Video (requires ffmpeg on PATH) ─────────────────────────────────

    private byte[] scrubVideo(byte[] original, String ext) throws IOException, InterruptedException {
        if (!isFfmpegAvailable()) {
            log.warn("ffmpeg not found on PATH — video uploaded without metadata scrubbing. " +
                    "Install ffmpeg in the deploy environment to enable this.");
            return original;
        }

        File tmpDir = Files.createTempDirectory("media-scrub").toFile();
        File in = new File(tmpDir, "in." + ext);
        File out = new File(tmpDir, "out." + ext);
        try {
            Files.write(in.toPath(), original);

            // -map_metadata -1 drops all container/stream metadata
            // (location, device, creation time, author, etc.).
            // -c copy stream-copies audio/video without re-encoding, so
            // there's no quality loss and it's fast.
            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-y", "-i", in.getAbsolutePath(),
                    "-map_metadata", "-1",
                    "-c", "copy",
                    out.getAbsolutePath()
            );
            pb.redirectErrorStream(true);
            Process proc = pb.start();
            // Drain stdout/stderr so ffmpeg never blocks on a full pipe buffer.
            try (InputStream is = proc.getInputStream()) {
                is.readAllBytes();
            }
            boolean finished = proc.waitFor(60, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) {
                proc.destroyForcibly();
                log.warn("ffmpeg timed out scrubbing video metadata — uploading original file.");
                return original;
            }
            if (proc.exitValue() != 0 || !out.exists() || out.length() == 0) {
                log.warn("ffmpeg exited with code {} — uploading original file.", proc.exitValue());
                return original;
            }
            return Files.readAllBytes(out.toPath());
        } finally {
            //noinspection ResultOfMethodCallIgnored
            in.delete();
            //noinspection ResultOfMethodCallIgnored
            out.delete();
            //noinspection ResultOfMethodCallIgnored
            tmpDir.delete();
        }
    }

    private boolean isFfmpegAvailable() {
        Boolean cached = ffmpegAvailable;
        if (cached != null) return cached;
        synchronized (this) {
            if (ffmpegAvailable != null) return ffmpegAvailable;
            boolean available;
            try {
                Process proc = new ProcessBuilder("ffmpeg", "-version")
                        .redirectErrorStream(true)
                        .start();
                try (InputStream is = proc.getInputStream()) {
                    is.readAllBytes();
                }
                available = proc.waitFor(5, java.util.concurrent.TimeUnit.SECONDS) && proc.exitValue() == 0;
            } catch (Exception e) {
                available = false;
            }
            ffmpegAvailable = available;
            return available;
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private String extensionOf(String filename, String contentType) {
        if (filename != null && filename.contains(".")) {
            String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
            if (!ext.isBlank()) return ext;
        }
        if (contentType != null) {
            if (contentType.contains("jpeg")) return "jpg";
            if (contentType.contains("png")) return "png";
            if (contentType.contains("webp")) return "webp";
            if (contentType.contains("mp4")) return "mp4";
            if (contentType.contains("quicktime")) return "mov";
            if (contentType.contains("webm")) return "webm";
        }
        return "";
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }

    private static long readUInt32BE(byte[] data, int offset) {
        return ((long) (data[offset] & 0xFF) << 24)
                | ((data[offset + 1] & 0xFF) << 16)
                | ((data[offset + 2] & 0xFF) << 8)
                | (data[offset + 3] & 0xFF);
    }

    private static long readUInt32LE(byte[] data, int offset) {
        return ((long) (data[offset + 3] & 0xFF) << 24)
                | ((data[offset + 2] & 0xFF) << 16)
                | ((data[offset + 1] & 0xFF) << 8)
                | (data[offset] & 0xFF);
    }

    private static void writeUInt32LE(ByteArrayOutputStream out, long value) {
        out.write((int) (value & 0xFF));
        out.write((int) ((value >> 8) & 0xFF));
        out.write((int) ((value >> 16) & 0xFF));
        out.write((int) ((value >> 24) & 0xFF));
    }
}
