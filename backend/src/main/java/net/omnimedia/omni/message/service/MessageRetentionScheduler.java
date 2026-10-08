package net.omnimedia.omni.message.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.config.R2StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Runs the purge once a minute, but only when messages.purge.enabled=true (default: off). */
@Component
@RequiredArgsConstructor
public class MessageRetentionScheduler {

    private static final Logger LOG = LoggerFactory.getLogger(MessageRetentionScheduler.class);

    private final MessageRetentionService retention;
    private final R2StorageService r2;

    @Value("${messages.purge.enabled:false}")
    private boolean enabled;

    @Scheduled(initialDelay = 120_000, fixedDelay = 60_000)
    public void run() {
        if (!enabled) return;
        try {
            MessageRetentionService.PurgeResult r = retention.purgeNow();
            // Database rows are already gone and committed; now remove the files from the bucket.
            for (String url : r.mediaUrls()) r2.deleteByUrl(url);
            if (r.dms() + r.groups() > 0) {
                LOG.info("[retention] purged {} direct and {} group messages, {} media files",
                        r.dms(), r.groups(), r.mediaUrls().size());
            }
        } catch (Exception e) {
            LOG.warn("[retention] purge failed: {}", e.toString());
        }
    }
}
