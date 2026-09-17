package net.omnimedia.omni.util.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.*;

@RestController
@RequestMapping("/link-preview")
@CrossOrigin(origins = "*")
public class LinkPreviewController {

    private static final int TIMEOUT_MS = 5000;
    private static final int MAX_BYTES  = 65536; // read at most 64 KB of HTML

    @GetMapping
    public ResponseEntity<?> preview(@RequestParam String url) {
        try {
            // Basic URL validation
            URI uri = new URI(url);
            if (!uri.getScheme().startsWith("http")) {
                return ResponseEntity.badRequest().body("Only http/https URLs are supported");
            }

            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);
            conn.setRequestProperty("User-Agent",
                "Mozilla/5.0 (compatible; OmniBot/1.0; +https://omnimedia.net)");
            conn.setInstanceFollowRedirects(true);
            conn.connect();

            // Only parse HTML responses
            String contentType = conn.getContentType();
            if (contentType == null || !contentType.contains("text/html")) {
                conn.disconnect();
                return ResponseEntity.ok(Map.of(
                    "url", url,
                    "title", extractDomain(url),
                    "description", "",
                    "image", "",
                    "siteName", extractDomain(url)
                ));
            }

            // Read capped chunk
            byte[] buf = new byte[MAX_BYTES];
            int read;
            try (InputStream is = conn.getInputStream()) {
                read = is.read(buf);
            }
            conn.disconnect();

            String html = new String(buf, 0, Math.max(read, 0), StandardCharsets.UTF_8);

            Map<String, String> result = new LinkedHashMap<>();
            result.put("url",         url);
            result.put("title",       firstOf(
                og(html, "title"), twitterMeta(html, "title"), titleTag(html), extractDomain(url)));
            result.put("description", firstOf(
                og(html, "description"), twitterMeta(html, "description"), metaDescription(html), ""));
            result.put("image",       firstOf(
                og(html, "image"), twitterMeta(html, "image"), ""));
            result.put("siteName",    firstOf(
                og(html, "site_name"), extractDomain(url)));

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch preview: " + e.getMessage()));
        }
    }

    // ── Helpers ──

    private String og(String html, String prop) {
        Matcher m = Pattern.compile(
            "<meta[^>]+property=[\"']og:" + prop + "[\"'][^>]+content=[\"']([^\"']*)[\"']",
            Pattern.CASE_INSENSITIVE).matcher(html);
        if (m.find()) return m.group(1).trim();
        // also try reversed attribute order
        Matcher m2 = Pattern.compile(
            "<meta[^>]+content=[\"']([^\"']*)[\"'][^>]+property=[\"']og:" + prop + "[\"']",
            Pattern.CASE_INSENSITIVE).matcher(html);
        return m2.find() ? m2.group(1).trim() : "";
    }

    private String twitterMeta(String html, String name) {
        Matcher m = Pattern.compile(
            "<meta[^>]+name=[\"']twitter:" + name + "[\"'][^>]+content=[\"']([^\"']*)[\"']",
            Pattern.CASE_INSENSITIVE).matcher(html);
        if (m.find()) return m.group(1).trim();
        Matcher m2 = Pattern.compile(
            "<meta[^>]+content=[\"']([^\"']*)[\"'][^>]+name=[\"']twitter:" + name + "[\"']",
            Pattern.CASE_INSENSITIVE).matcher(html);
        return m2.find() ? m2.group(1).trim() : "";
    }

    private String titleTag(String html) {
        Matcher m = Pattern.compile("<title[^>]*>([^<]*)</title>", Pattern.CASE_INSENSITIVE).matcher(html);
        return m.find() ? m.group(1).trim() : "";
    }

    private String metaDescription(String html) {
        Matcher m = Pattern.compile(
            "<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']*)[\"']",
            Pattern.CASE_INSENSITIVE).matcher(html);
        if (m.find()) return m.group(1).trim();
        Matcher m2 = Pattern.compile(
            "<meta[^>]+content=[\"']([^\"']*)[\"'][^>]+name=[\"']description[\"']",
            Pattern.CASE_INSENSITIVE).matcher(html);
        return m2.find() ? m2.group(1).trim() : "";
    }

    private String extractDomain(String url) {
        try { return new URI(url).getHost().replaceFirst("^www\\.", ""); }
        catch (Exception e) { return url; }
    }

    private String firstOf(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return "";
    }
}
