package net.omnimedia.omni.media.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Cuts a video down to a [trimStart, trimEnd] range via ffmpeg, requested
 * from VideoTrimEditor.js on the RN client (and the web equivalent) —
 * see MessageRestController's handling of the trimStart/trimEnd params.
 *
 * Same ffmpeg-on-PATH dependency as MediaMetadataScrubber (already
 * installed in the backend's Dockerfile), and the same best-effort
 * philosophy: any failure here returns the ORIGINAL untrimmed bytes
 * rather than blocking the upload, so a trim going wrong never turns
 * into a lost message.
 *
 * Re-encodes rather than stream-copying. A stream-copy trim (-c copy)
 * only cuts at the nearest keyframe, which for a typical phone-camera
 * GOP structure can land visibly away from the exact point the user
 * dragged the handle to — bad for something as short as a chat video
 * clip, where a second or two of drift is obvious. Combining a fast
 * seek (-ss before -i) with a re-encode gets an exact cut at both ends
 * without the much slower full-decode-from-start seek that -ss after
 * -i would require.
 */
@Component
public class VideoTrimService {

    private static final Logger log = LoggerFactory.getLogger(VideoTrimService.class);

    private volatile Boolean ffmpegAvailable;

    /**
     * Returns trimmed video bytes (always re-encoded to H.264/AAC mp4
     * regardless of input container), or the original bytes unchanged if
     * ffmpeg is unavailable, the range is invalid, or trimming fails for
     * any reason.
     */
    public byte[] trim(byte[] original, String ext, double startSeconds, double endSeconds) {
        double duration = endSeconds - startSeconds;
        if (duration <= 0 || startSeconds < 0) {
            log.warn("Invalid trim range [{}, {}] — uploading original file untrimmed.", startSeconds, endSeconds);
            return original;
        }
        if (!isFfmpegAvailable()) {
            log.warn("ffmpeg not found on PATH — video uploaded untrimmed.");
            return original;
        }

        String inExt = (ext == null || ext.isBlank()) ? "mp4" : ext.toLowerCase(Locale.ROOT);
        File tmpDir = null;
        try {
            tmpDir = Files.createTempDirectory("video-trim").toFile();
            File in = new File(tmpDir, "in." + inExt);
            File out = new File(tmpDir, "out.mp4");
            Files.write(in.toPath(), original);

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-y",
                    "-ss", String.valueOf(startSeconds),
                    "-i", in.getAbsolutePath(),
                    "-t", String.valueOf(duration),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-c:a", "aac",
                    "-movflags", "+faststart",
                    out.getAbsolutePath()
            );
            pb.redirectErrorStream(true);
            Process proc = pb.start();
            try (InputStream is = proc.getInputStream()) {
                is.readAllBytes(); // drain so ffmpeg never blocks on a full pipe buffer
            }
            // Re-encoding a clip takes meaningfully longer than the
            // metadata scrubber's stream-copy — 120s covers a generous
            // chat-length clip on Render's modest CPU allocation without
            // leaving a runaway process hanging indefinitely on failure.
            boolean finished = proc.waitFor(120, TimeUnit.SECONDS);
            if (!finished) {
                proc.destroyForcibly();
                log.warn("ffmpeg timed out trimming video — uploading original file untrimmed.");
                return original;
            }
            if (proc.exitValue() != 0 || !out.exists() || out.length() == 0) {
                log.warn("ffmpeg exited with code {} trimming video — uploading original file untrimmed.", proc.exitValue());
                return original;
            }
            return Files.readAllBytes(out.toPath());
        } catch (IOException | InterruptedException e) {
            log.warn("Video trim failed, uploading original file untrimmed: {}", e.getMessage());
            return original;
        } finally {
            if (tmpDir != null) {
                deleteRecursive(tmpDir);
            }
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
                available = proc.waitFor(5, TimeUnit.SECONDS) && proc.exitValue() == 0;
            } catch (Exception e) {
                available = false;
            }
            ffmpegAvailable = available;
            return available;
        }
    }

    private static void deleteRecursive(File f) {
        File[] children = f.listFiles();
        if (children != null) {
            for (File c : children) deleteRecursive(c);
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
