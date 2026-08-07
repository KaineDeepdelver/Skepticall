package net.omnimedia.omni.admin.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.omnimedia.omni.admin.entity.Admin;
import net.omnimedia.omni.admin.repository.AdminRepository;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Bootstraps the very first admin so there's a way in without manual SQL.
 * Only runs when the admins table is completely empty — once at least one
 * admin exists, this is a no-op forever (admins manage admins from there).
 *
 * Configure via admin.bootstrap.email in application.properties.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrapRunner implements CommandLineRunner {

    private final AdminRepository adminRepo;
    private final UserRepository userRepo;

    @Value("${admin.bootstrap.email:}")
    private String bootstrapEmail;

    @Override
    public void run(String... args) {
        if (adminRepo.count() > 0) return; // already have at least one admin, nothing to do
        if (bootstrapEmail == null || bootstrapEmail.isBlank()) return;

        userRepo.findByEmail(bootstrapEmail).ifPresentOrElse(
                (User user) -> {
                    adminRepo.save(Admin.builder().user(user).build());
                    log.warn("👑🚀 Bootstrap admin privileges GRANTED to [{}]", bootstrapEmail);
                },
                () -> log.warn("👑⚠️ Admin bootstrap email set to [{}] but user does not exist. Action required: register account and restart.", bootstrapEmail)
        );

    }
}
