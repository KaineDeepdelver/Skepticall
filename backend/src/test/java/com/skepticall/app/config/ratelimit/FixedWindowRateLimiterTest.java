package com.skepticall.app.config.ratelimit;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The counting rules: how many hits are allowed, when the count starts again, and what is kept. */
class FixedWindowRateLimiterTest {

    private static final long MINUTE = 60_000L;

    @Test
    void allowsUpToTheLimitThenRefuses() {
        AtomicLong now = new AtomicLong(1_000);
        FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(now::get, 100);

        for (int i = 0; i < 3; i++) {
            assertTrue(limiter.tryAcquire("login|1.2.3.4", 3, MINUTE).allowed(), "hit " + (i + 1) + " is within the limit");
        }
        var refused = limiter.tryAcquire("login|1.2.3.4", 3, MINUTE);
        assertFalse(refused.allowed());
        assertTrue(refused.retryAfterSeconds() >= 1 && refused.retryAfterSeconds() <= 60);
    }

    @Test
    void retryAfterCountsDownToTheEndOfTheWindow() {
        AtomicLong now = new AtomicLong(0);
        FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(now::get, 100);
        limiter.tryAcquire("k", 1, MINUTE);          // opens a window that ends at 60s

        now.set(10_000);
        assertEquals(50, limiter.tryAcquire("k", 1, MINUTE).retryAfterSeconds());
        now.set(59_500);
        assertEquals(1, limiter.tryAcquire("k", 1, MINUTE).retryAfterSeconds());
    }

    @Test
    void theCountStartsAgainWhenTheWindowEnds() {
        AtomicLong now = new AtomicLong(0);
        FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(now::get, 100);
        limiter.tryAcquire("k", 1, MINUTE);
        assertFalse(limiter.tryAcquire("k", 1, MINUTE).allowed());

        now.set(MINUTE);                              // the window has just ended
        assertTrue(limiter.tryAcquire("k", 1, MINUTE).allowed());
    }

    @Test
    void differentKeysAreCountedSeparately() {
        AtomicLong now = new AtomicLong(0);
        FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(now::get, 100);
        assertTrue(limiter.tryAcquire("login|1.1.1.1", 1, MINUTE).allowed());
        assertFalse(limiter.tryAcquire("login|1.1.1.1", 1, MINUTE).allowed());

        assertTrue(limiter.tryAcquire("login|2.2.2.2", 1, MINUTE).allowed(), "another address is unaffected");
        assertTrue(limiter.tryAcquire("send-code|1.1.1.1", 1, MINUTE).allowed(), "another rule is unaffected");
    }

    @Test
    void expiredCountersAreDropped() {
        AtomicLong now = new AtomicLong(0);
        FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(now::get, 100_000);
        for (int i = 0; i < 500; i++) limiter.tryAcquire("ip" + i, 5, MINUTE);
        assertEquals(500, limiter.size());

        now.set(2 * MINUTE);
        for (int i = 0; i < 1000; i++) limiter.tryAcquire("fresh", 5_000, MINUTE); // enough calls to trigger a sweep
        assertEquals(1, limiter.size(), "only the current counter is left");
    }

    @Test
    void whenTheTableIsFullNewKeysAreLetThroughNotBlocked() {
        AtomicLong now = new AtomicLong(0);
        FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(now::get, 10);
        for (int i = 0; i < 20; i++) limiter.tryAcquire("ip" + i, 1, MINUTE);

        assertTrue(limiter.tryAcquire("a-brand-new-key", 1, MINUTE).allowed());
        assertTrue(limiter.tryAcquire("a-brand-new-key", 1, MINUTE).allowed(), "not counted while the table is full");
    }

    @Test
    void manyThreadsNeverLetMoreThanTheLimitThrough() throws Exception {
        FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(() -> 0L, 100);
        java.util.concurrent.atomic.AtomicInteger allowed = new java.util.concurrent.atomic.AtomicInteger();
        Thread[] threads = new Thread[8];
        for (int t = 0; t < threads.length; t++) {
            threads[t] = new Thread(() -> {
                for (int i = 0; i < 500; i++) {
                    if (limiter.tryAcquire("shared", 100, MINUTE).allowed()) allowed.incrementAndGet();
                }
            });
            threads[t].start();
        }
        for (Thread th : threads) th.join();
        assertEquals(100, allowed.get());
    }
}
