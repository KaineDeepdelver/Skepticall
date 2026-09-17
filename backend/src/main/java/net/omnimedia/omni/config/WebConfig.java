package net.omnimedia.omni.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    // No more "/uploads/**" resource handler here — uploaded files now live
    // in Cloudflare R2 and are served directly from there (see
    // R2StorageService), not proxied through this backend. Local disk
    // storage doesn't survive Render's ephemeral filesystem, so it's gone.

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("*") // allow frontend
                .allowedMethods("*")
                .allowedHeaders("*");
    }
}
