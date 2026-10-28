package com.skepticall.app.config.ratelimit;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.LongSupplier;

/**
 * A fixed-window counter: at most {@code limit} hits per key in each window.
 *
 * <p>Counters live in memory only and are dropped as soon as their window has passed, so nothing about a
 * visitor is kept beyond a minute or so (a few windows are an hour long, see {@link RateLimitRules}). This is
 * one instance's view: with several server instances each counts separately, which is fine for blunting
 * guessing and floods.
 *
 * <p>If so many different keys arrive that the table is full, new keys are let through without being
 * counted. That keeps the server up during an attack at the cost of letting some traffic past.
 */
public class FixedWindowRateLimiter {

    /** The outcome of one hit. {@code retryAfterSeconds} is 0 when the hit is allowed. */
    public record Decision(boolean allowed, long retryAfterSeconds) {}

    private record Window(long end, int count) {}

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final LongSupplier clockMillis;
    private final int maxKeys;
    private final AtomicInteger sinceSweep = new AtomicInteger();

    public FixedWindowRateLimiter(LongSupplier clockMillis, int maxKeys) {
        this.clockMillis = clockMillis;
        this.maxKeys = maxKeys;
    }

    /** Counts one hit for {@code key} and says whether it is within {@code limit} per {@code windowMillis}. */
    public Decision tryAcquire(String key, int limit, long windowMillis) {
        long now = clockMillis.getAsLong();
        if (sinceSweep.incrementAndGet() >= 1000 || windows.size() > maxKeys) {
            sinceSweep.set(0);
            sweep(now);
        }
        if (windows.size() > maxKeys && !windows.containsKey(key)) {
            return new Decision(true, 0); // table full: fail open rather than refuse everyone
        }

        Window w = windows.compute(key, (k, old) ->
                (old == null || now >= old.end()) ? new Window(now + windowMillis, 1) : new Window(old.end(), old.count() + 1));

        if (w.count() <= limit) return new Decision(true, 0);
        long retry = Math.max(1, (w.end() - now + 999) / 1000);
        return new Decision(false, retry);
    }

    private void sweep(long now) {
        windows.entrySet().removeIf(e -> now >= e.getValue().end());
    }

    /** Number of counters currently held. For tests and monitoring. */
    public int size() {
        return windows.size();
    }
}
