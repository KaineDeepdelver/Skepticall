package net.omnimedia.omni.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.CommonsRequestLoggingFilter;

@Configuration
public class RequestLoggingConfig {

    @Bean
    public CommonsRequestLoggingFilter requestLoggingFilter() {
        CommonsRequestLoggingFilter filter = new CommonsRequestLoggingFilter();

        // Disable the technical default formatting
        filter.setIncludeQueryString(true);
        filter.setIncludePayload(false);
        filter.setMaxPayloadLength(10000);
        filter.setIncludeHeaders(false);

        // Custom clear sentences
        filter.setBeforeMessagePrefix("📥 Received request for: ");
        filter.setAfterMessagePrefix("✅ Successfully processed request for: ");

        return filter;
    }
}
