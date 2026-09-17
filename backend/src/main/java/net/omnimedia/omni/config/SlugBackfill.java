package net.omnimedia.omni.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.omnimedia.omni.post.entity.Post;
import net.omnimedia.omni.post.repository.PostRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * One-time backfill: any Post rows created before the slug column was added
 * will have slug = NULL. This bean runs at startup and assigns them a slug.
 *
 * Safe to leave in permanently — it short-circuits instantly once all rows
 * have a slug, so startup cost after the first run is a single COUNT query.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SlugBackfill {

    private final PostRepository postRepo;
    private static final Pattern NON_ALPHANUM = Pattern.compile("[^a-z0-9]+");

    @PostConstruct
    @Transactional
    public void backfill() {
        List<Post> missing = postRepo.findAll().stream()
                .filter(p -> p.getSlug() == null || p.getSlug().isBlank())
                .toList();

        if (missing.isEmpty()) return;

        log.info("SlugBackfill: assigning slugs to {} existing posts", missing.size());

        for (Post post : missing) {
            post.setSlug(generateSlug(post.getTitle()));
            postRepo.save(post);
        }

        log.info("SlugBackfill: done");
    }

    private String generateSlug(String title) {
        String base;
        if (title != null && !title.isBlank()) {
            String normalized = Normalizer.normalize(title.trim(), Normalizer.Form.NFD)
                    .replaceAll("\\p{M}", "");
            base = NON_ALPHANUM.matcher(normalized.toLowerCase()).replaceAll("-");
            base = base.replaceAll("^-+|-+$", "");
            if (base.length() > 48) base = base.substring(0, 48).replaceAll("-+$", "");
            if (base.isBlank()) base = "post";
        } else {
            base = "post";
        }
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        return base + "-" + suffix;
    }
}
