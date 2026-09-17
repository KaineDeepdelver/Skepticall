package net.omnimedia.omni.config;

import jakarta.annotation.PostConstruct;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.media.util.MediaMetadataScrubber;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

/**
 * Stores uploaded files (avatars, banners, post media, message attachments,
 * network icons/banners, ...) in Cloudflare R2 instead of local disk.
 *
 * This replaces the old local-disk approach (writing to a relative
 * "uploads/" folder and serving it via a Spring static resource handler).
 * That worked fine locally, but on Render — where the free tier's
 * filesystem is fully ephemeral and wiped on every redeploy, restart, or
 * spin-down, and persistent disks aren't even available on the free plan —
 * every uploaded file was guaranteed to eventually vanish while the DB row
 * pointing at it stayed behind. R2 is an external, durable object store, so
 * uploads now survive restarts/redeploys regardless of what Render does to
 * the container's disk.
 *
 * R2 speaks the S3 API, so this just uses the standard AWS S3 SDK pointed
 * at Cloudflare's endpoint instead of AWS's — no AWS account involved.
 */
@Component
public class R2StorageService {

    private final String accountId;
    private final String bucket;
    private final String publicBaseUrl; // e.g. https://cdn.skepticall.com  (no trailing slash)
    private final MediaMetadataScrubber metadataScrubber;

    private S3Client s3;

    public R2StorageService(
            @Value("${r2.account-id}") String accountId,
            @Value("${r2.access-key-id}") String accessKeyId,
            @Value("${r2.secret-access-key}") String secretAccessKey,
            @Value("${r2.bucket}") String bucket,
            @Value("${r2.public-base-url}") String publicBaseUrl,
            MediaMetadataScrubber metadataScrubber
    ) {
        this.accountId = accountId;
        this.bucket = bucket;
        this.metadataScrubber = metadataScrubber;
        this.publicBaseUrl = publicBaseUrl.endsWith("/")
                ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1)
                : publicBaseUrl;

        this.s3 = S3Client.builder()
                .endpointOverride(URI.create("https://" + accountId + ".r2.cloudflarestorage.com"))
                // R2 only supports "auto" as the region value.
                .region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKeyId, secretAccessKey)))
                .build();
    }

    @PostConstruct
    void validateConfig() {
        if (accountId == null || accountId.isBlank() || accountId.contains("your-")) {
            throw new IllegalStateException(
                    "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, " +
                    "R2_BUCKET and R2_PUBLIC_BASE_URL as environment variables."
            );
        }
    }

    /**
     * Uploads a file to R2 under a unique generated name and returns the
     * full public URL to store in the DB (e.g. https://cdn.skepticall.com/avatar_<uuid>.png).
     *
     * Same call shape as the old local-disk saveFile() helpers it replaces,
     * so call sites barely change.
     */
    public String upload(MultipartFile file, String prefix) {
        String orig = file.getOriginalFilename();
        Path tmpIn = null;
        try {
            String ext = extensionOf(orig);
            // Stream the multipart part straight to a temp file instead of
            // pulling it into a byte[] first. For a big video (tens/hundreds
            // of MB) the old file.getBytes() call held the *entire* file in
            // JVM heap, and the scrubber then produced a second full-size
            // byte[] on top of that for the ffmpeg output — on a small
            // container (e.g. Render's 512MB tier, where the JVM only sees
            // ~25% of that as heap by default) that double-buffering was
            // enough to OOM well before the file itself was anywhere near
            // Spring's 500MB multipart limit. transferTo() streams instead,
            // so memory use no longer scales with file size.
            tmpIn = Files.createTempFile("upload_", ext.isEmpty() ? ".bin" : ext);
            file.transferTo(tmpIn);
            return uploadFromTempFile(tmpIn, ext, orig, file.getContentType(), prefix);
        } catch (IOException e) {
            deleteQuietly(tmpIn);
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "💾 File persistence failed: Unable to upload media to R2. Reason: " + e.getMessage()
            );
        }
    }

    /**
     * Same as upload(MultipartFile, String), for callers that already have
     * raw bytes instead of a MultipartFile — VideoTrimService's and
     * ImageMarkupService's ffmpeg/Graphics2D output, which exist only as
     * in-memory bytes by the time they're ready to store (those services
     * already had to hold the full processed file in memory to produce it,
     * so writing it to a temp file here doesn't add a new peak — it just
     * lets the rest of the pipeline stay on the same streaming path as
     * upload(MultipartFile, String) instead of a separate byte[]-based one).
     */
    public String uploadBytes(byte[] rawBytes, String contentType, String originalFilename, String prefix) {
        String ext = extensionOf(originalFilename);
        Path tmpIn = null;
        try {
            tmpIn = Files.createTempFile("upload_", ext.isEmpty() ? ".bin" : ext);
            Files.write(tmpIn, rawBytes);
            return uploadFromTempFile(tmpIn, ext, originalFilename, contentType, prefix);
        } catch (IOException e) {
            deleteQuietly(tmpIn);
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "💾 File persistence failed: Unable to upload media to R2. Reason: " + e.getMessage()
            );
        }
    }

    /** Shared core: scrub the on-disk file at tmpIn, upload it to R2, clean up temp files either way. */
    private String uploadFromTempFile(Path tmpIn, String ext, String originalFilename, String contentType, String prefix) {
        MediaMetadataScrubber.ScrubResult scrubbed = null;
        try {
            String key = prefix + "_" + UUID.randomUUID() + ext;

            // Strip EXIF/GPS/device metadata before it ever reaches R2.
            // Best-effort: on any failure this passes the original file
            // through unscrubbed rather than blocking the upload.
            scrubbed = metadataScrubber.scrub(tmpIn, originalFilename, contentType);

            s3.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(scrubbed.contentType)
                            .build(),
                    RequestBody.fromFile(scrubbed.path)
            );

            return publicBaseUrl + "/" + key;
        } finally {
            // scrubbed.path is either tmpIn itself (passthrough) or a
            // separate scrubbed temp file — only delete it separately when
            // it's actually different from tmpIn, then always clean up tmpIn.
            if (scrubbed != null && !scrubbed.path.equals(tmpIn)) {
                deleteQuietly(scrubbed.path);
            }
            deleteQuietly(tmpIn);
        }
    }

    private static String extensionOf(String filename) {
        if (filename != null && filename.contains(".")) {
            return filename.substring(filename.lastIndexOf('.'));
        }
        return "";
    }

    private static void deleteQuietly(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // best-effort cleanup — a leftover temp file isn't worth failing the request over
        }
    }
}
