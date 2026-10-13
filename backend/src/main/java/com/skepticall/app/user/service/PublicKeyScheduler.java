package com.skepticall.app.user.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Hourly: removes retired public keys whose grace period has ended. */
@Component
@RequiredArgsConstructor
public class PublicKeyScheduler {

    private static final Logger LOG = LoggerFactory.getLogger(PublicKeyScheduler.class);

    private final PublicKeyService publicKeys;

    @Scheduled(initialDelay = 300_000, fixedDelay = 3_600_000)
    public void purgeExpired() {
        try {
            int removed = publicKeys.purgeExpired();
            if (removed > 0) {
                LOG.info("[keys] removed {} expired retired public keys", removed);
            }
        } catch (Exception e) {
            LOG.warn("[keys] expired-key cleanup failed: {}", e.toString());
        }
    }
}
