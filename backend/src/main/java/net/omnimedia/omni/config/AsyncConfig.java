package net.omnimedia.omni.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

// Dedicated thread pool for outbound push-notification HTTP calls (see
// PushNotificationService) so a slow/unavailable Expo API can never add
// latency to the request that triggered a notification — sending a
// message, following someone, starting a call, etc.
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "pushExecutor")
    public Executor pushExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(6);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("push-notif-");
        executor.initialize();
        return executor;
    }
}
