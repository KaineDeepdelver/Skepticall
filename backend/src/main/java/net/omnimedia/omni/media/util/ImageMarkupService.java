package net.omnimedia.omni.media.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.GeneralPath;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Draws the freehand strokes captured by ImageMarkupEditor.js (RN) /
 * web's equivalent onto the source image server-side, via plain
 * Graphics2D — see MessageRestController's `strokes` param.
 *
 * Why server-side at all, instead of flattening on the client before
 * upload: the RN client only has react-native-svg for drawing, which
 * renders strokes but can't rasterize them onto a photo by itself —
 * that needs react-native-view-shot, which isn't in Expo Go's built-in
 * module set. Doing it here keeps the client on Expo Go and needs
 * nothing beyond the JDK that's already there either way.
 *
 * Strokes come in normalized (0..1) against however the image was
 * displayed on whichever device drew them, so this scales every point
 * to the source image's actual pixel dimensions before drawing —
 * meaning the result lines up correctly regardless of screen size.
 *
 * "erase" strokes are NOT compositing-erased (there's no straightforward
 * way to do that here without alpha-channel canvas semantics matching
 * exactly what view-shot would have produced) — they're simply skipped,
 * so an eraser stroke effectively "un-draws" ink that hadn't been
 * committed to the raster yet. That covers the common case (undo a
 * stroke you're still mid-drawing) but won't erase ink from an earlier,
 * already-drawn stroke it overlaps.
 */
@Component
public class ImageMarkupService {

    private static final Logger log = LoggerFactory.getLogger(ImageMarkupService.class);
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Returns image bytes (always re-encoded as PNG, to avoid JPEG
     * artifacting compounding on top of freehand ink) with the given
     * strokes drawn on, or the original bytes unchanged if strokesJson is
     * blank/unparseable or drawing fails for any reason.
     */
    public byte[] applyStrokes(byte[] original, String strokesJson) {
        if (strokesJson == null || strokesJson.isBlank()) return original;

        try {
            JsonNode strokes = mapper.readTree(strokesJson);
            if (!strokes.isArray() || strokes.isEmpty()) return original;

            BufferedImage image = ImageIO.read(new ByteArrayInputStream(original));
            if (image == null) {
                log.warn("applyStrokes: could not decode source image — uploading unmarked original.");
                return original;
            }

            // Work on an ARGB copy so stroke opacity composites correctly
            // regardless of the source image's original color model.
            BufferedImage canvas = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = canvas.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
            g.drawImage(image, 0, 0, null);

            int w = image.getWidth();
            int h = image.getHeight();

            for (JsonNode stroke : strokes) {
                if (stroke.path("erase").asBoolean(false)) continue; // see class doc

                JsonNode points = stroke.path("points");
                if (!points.isArray() || points.size() < 2) continue;

                Color color = parseColor(stroke.path("color").asText("#000000"));
                float opacity = (float) clamp01(stroke.path("opacity").asDouble(1.0));
                float strokeWidth = (float) Math.max(1, stroke.path("width").asDouble(6));

                GeneralPath path = new GeneralPath();
                boolean first = true;
                for (JsonNode p : points) {
                    float x = (float) (p.path("x").asDouble(0) * w);
                    float y = (float) (p.path("y").asDouble(0) * h);
                    if (first) { path.moveTo(x, y); first = false; }
                    else path.lineTo(x, y);
                }

                g.setColor(new Color(color.getRed(), color.getGreen(), color.getBlue(), Math.round(opacity * 255)));
                g.setStroke(new BasicStroke(strokeWidth, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
                g.draw(path);
            }
            g.dispose();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(canvas, "png", out);
            return out.toByteArray();
        } catch (IOException | RuntimeException e) {
            log.warn("applyStrokes failed, uploading unmarked original: {}", e.getMessage());
            return original;
        }
    }

    private static double clamp01(double v) {
        return Math.max(0, Math.min(1, v));
    }

    private static Color parseColor(String hex) {
        try {
            return Color.decode(hex);
        } catch (NumberFormatException e) {
            return Color.BLACK;
        }
    }
}
