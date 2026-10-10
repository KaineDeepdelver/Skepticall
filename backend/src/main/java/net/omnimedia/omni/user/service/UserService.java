package net.omnimedia.omni.user.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.admin.repository.AdminRepository;
import net.omnimedia.omni.captcha.service.CaptchaService;
import net.omnimedia.omni.config.R2StorageService;
import net.omnimedia.omni.config.jwt.JwtUtil;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.user.dto.*;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.mapper.UserMapper;
import net.omnimedia.omni.user.repository.UserRepository;
import net.omnimedia.omni.verification.entity.VerificationCode;
import net.omnimedia.omni.verification.service.VerificationService;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserService {

    private final VerificationService verificationService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminRepository adminRepository;
    private final JwtUtil jwtUtil;
    private final CaptchaService captchaService;
    private final R2StorageService r2Storage;
    private final net.omnimedia.omni.verification.service.EmailService emailService;

    // == Auth =================================================================

    public LoginResponseDTO register(RegisterDTO dto) {
        if (!captchaService.verify(dto.getCaptchaToken())) {
            throw new BusinessException(
                    ErrorType.INVALID_TOKEN,
                    "Captcha verification failed. Please try again."
            );
        }

        if (userRepository.findByUsername(dto.getUsername()).isPresent()) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Username already taken [username=" + dto.getUsername() + "]"
            );
        }

        if (userRepository.findByEmail(dto.getEmail()).isPresent()) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Email already in use [email=" + dto.getEmail() + "]"
            );
        }


        User user = User.builder()
                .username(dto.getUsername())
                .email(dto.getEmail())
                .password(passwordEncoder.encode(dto.getPassword()))
                .displayName(dto.getDisplayName())
                .build();

        UserDTO userDTO = toDTOWithAdmin(userRepository.save(user));
        String token = jwtUtil.generate(userDTO.getId(), userDTO.getAdmin());
        return new LoginResponseDTO(token, userDTO);
    }

    public LoginResponseDTO login(LoginDTO dto) {
        return login(dto, null);
    }

    // ip may be null (unknown). Used for the "IP login alerts" setting.
    public LoginResponseDTO login(LoginDTO dto, String ip) {
        User user = userRepository.findByEmail(dto.getEmail())
                .orElseThrow(() -> new BusinessException(ErrorType.INVALID_OPERATION, "Invalid email or password"));

        if (!passwordEncoder.matches(dto.getPassword(), user.getPassword())) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Invalid email or password");
        }


        // Remember where this sign-in came from; if it differs from the last one and the
        // user turned on IP login alerts, email them. Never let this block a login.
        try {
            String previousIp = user.getLastLoginIp();
            boolean newIp = ip != null && previousIp != null && !previousIp.equals(ip);
            if (ip != null) user.setLastLoginIp(ip);
            user.setLastLoginAt(java.time.Instant.now().toString());
            userRepository.save(user);
            if (newIp && user.isIpLoginAlerts()) {
                emailService.sendCustomEmail(user.getEmail(), "New sign-in to your Skepticall account",
                        "<p>Your account was just signed in to from a new IP address: <b>" + ip + "</b>.</p>"
                        + "<p>If this was you, nothing to do. If not, change your password right away.</p>");
            }
        } catch (Exception ignored) {
            
        }

        UserDTO userDTO = toDTOWithAdmin(user);
        String token = jwtUtil.generate(userDTO.getId(), userDTO.getAdmin());
        return new LoginResponseDTO(token, userDTO);
    }

    // == Remember-me ==========================================================

    public String issueRememberToken(Long userId, long ttlMs) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User not found [id=" + userId + "]"));
        return jwtUtil.generateRemember(userId, JwtUtil.passwordTag(user.getPassword()), ttlMs);
    }

    /** Exchanges a valid remember token for a fresh access token + user, like a login without the password. */
    public LoginResponseDTO restoreSession(String rememberToken) {
        io.jsonwebtoken.Claims claims = jwtUtil.parseRemember(rememberToken);
        if (claims == null) {
            throw new BusinessException(ErrorType.INVALID_TOKEN, "Invalid or expired session");
        }
        User user = userRepository.findById(Long.parseLong(claims.getSubject()))
                .orElseThrow(() -> new BusinessException(ErrorType.INVALID_TOKEN, "Invalid or expired session"));
        if (!JwtUtil.passwordTag(user.getPassword()).equals(claims.get("pw", String.class))) {
            throw new BusinessException(ErrorType.INVALID_TOKEN, "Invalid or expired session");
        }
        UserDTO userDTO = toDTOWithAdmin(user);
        String token = jwtUtil.generate(userDTO.getId(), userDTO.getAdmin());
        return new LoginResponseDTO(token, userDTO);
    }

    // == Password Reset ===========================================================

    public void resetPassword(String email, String code, String newPassword) {
        verificationService.verifyCode(email, code, VerificationCode.CodeType.FORGOT_PASSWORD);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User not found [email=" + email + "]"));

        if (newPassword == null || newPassword.length() < 6) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Password must be at least 8 characters");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    // == Queries ==============================================================

    @Cacheable(value = "users", key = "#id")
    public UserDTO getUser(Long id) {
        System.out.println(">>> CACHE MISS - hitting DB for user " + id);
        return toDTOWithAdmin(
                userRepository.findById(id)
                        .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + id + "]"))
        );
    }

    public UserPublicDTO getPublicUser(Long id) {
        return toPublicDTOWithAdmin(
                userRepository.findById(id)
                        .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + id + "]"))
        );
    }

    public UserPublicDTO getPublicUserByUsername(String username) {
        return toPublicDTOWithAdmin(
                userRepository.findByUsername(username)
                        .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [username=" + username + "]"))
        );
    }

    public List<UserDTO> searchUsers(String query) {
        return userRepository
                .findByDisplayNameContainingIgnoreCaseOrUsernameContainingIgnoreCase(query, query)
                .stream()
                .map(this::toDTOWithAdmin)
                .toList();
    }

    public List<UserPublicDTO> searchUsersPublic(String query) {
        return userRepository
                .findByDisplayNameContainingIgnoreCaseOrUsernameContainingIgnoreCase(query, query)
                .stream()
                .filter(u -> !u.isPrivacyMode()) // "Privacy mode": hidden from search results
                .map(this::toPublicDTOWithAdmin)
                .toList();
    }

    public boolean emailExists(String email) {
        return userRepository.findByEmail(email).isPresent();
    }

    public boolean usernameExists(String username) {
        return userRepository.findByUsername(username).isPresent();
    }

    // == Ownership guard ======================================================
    
    public void requireSelf(Long callerId, Long targetId) {
        if (callerId == null)
            throw new SecurityException("Authentication required");
        if (!callerId.equals(targetId) && !adminRepository.existsByUserId(callerId))
            throw new SecurityException("You are not allowed to modify another user's data");
    }

    // == Updates ==============================================================

    @CachePut(value = "users", key = "#id")
    public UserDTO updateProfile(Long id, String displayName, String bio,
                                 MultipartFile file, MultipartFile banner) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + id + "]"));

        if (displayName != null) user.setDisplayName(displayName);
        if (bio != null) user.setBio(bio);

        if (file != null && !file.isEmpty())
            user.setProfilePicture(saveFile(file, "avatar"));

        if (banner != null && !banner.isEmpty())
            user.setBannerPicture(saveFile(banner, "banner"));

        return toDTOWithAdmin(userRepository.save(user));
    }

    @CachePut(value = "users", key = "#id")
    public UserDTO updateAccount(Long id, Map<String, String> body) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + id + "]"));

        if (body.containsKey("username")) {
            String newUsername = body.get("username");
            if (!newUsername.equals(user.getUsername()) && userRepository.findByUsername(newUsername).isPresent()) {
                throw new BusinessException(ErrorType.INVALID_OPERATION, "Username already taken [username=" + newUsername + "]");
            }
            user.setUsername(newUsername);
        }

        if (body.containsKey("email")) {
            String newEmail = body.get("email");
            if (!newEmail.equals(user.getEmail()) && userRepository.findByEmail(newEmail).isPresent()) {
                throw new BusinessException(ErrorType.INVALID_OPERATION, "Email already in use [email=" + newEmail + "]");
            }
            user.setEmail(newEmail);
        }

        if (body.containsKey("newPassword")) {
            String currentPw = body.get("currentPassword");
            if (currentPw == null || !passwordEncoder.matches(currentPw, user.getPassword())) {
                throw new BusinessException(ErrorType.INVALID_OPERATION, "Current password is incorrect");
            }
            String newPw = body.get("newPassword");
            if (newPw == null || newPw.length() < 6) {
                throw new BusinessException(ErrorType.INVALID_OPERATION, "New password must be at least 6 characters");
            }
            user.setPassword(passwordEncoder.encode(newPw));
        }

        return toDTOWithAdmin(userRepository.save(user));
    }


    @CachePut(value = "users", key = "#id")
    public UserDTO updatePrivacy(Long id, boolean privacyMode) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + id + "]"));

        user.setPrivacyMode(privacyMode);
        return toDTOWithAdmin(userRepository.save(user));
    }

    private static final java.util.Set<String> SETTING_KEYS = java.util.Set.of(
            "privacyMode", "appearOffline",
            "notifMessages", "notifMentions", "notifFollows", "notifReposts",
            "profanityMode", "ipLoginAlerts", "allowFriendRequests", "groupInvitesAnyone");

    /** Generic on/off settings. Only whitelisted keys are applied; values must be booleans. */
    @CachePut(value = "users", key = "#id")
    public UserDTO updateSettings(Long id, Map<String, Object> body) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + id + "]"));
        for (Map.Entry<String, Object> e : body.entrySet()) {
            String k = e.getKey();
            if (!SETTING_KEYS.contains(k)) continue;
            if (!(e.getValue() instanceof Boolean)) {
                throw new BusinessException(ErrorType.INVALID_OPERATION, "Setting must be true or false [key=" + k + "]");
            }
            boolean v = (Boolean) e.getValue();
            if (k.equals("privacyMode")) user.setPrivacyMode(v);
            else if (k.equals("appearOffline")) user.setAppearOffline(v);
            else if (k.equals("notifMessages")) user.setNotifMessages(v);
            else if (k.equals("notifMentions")) user.setNotifMentions(v);
            else if (k.equals("notifFollows")) user.setNotifFollows(v);
            else if (k.equals("notifReposts")) user.setNotifReposts(v);
            else if (k.equals("profanityMode")) user.setProfanityMode(v);
            else if (k.equals("ipLoginAlerts")) user.setIpLoginAlerts(v);
            else if (k.equals("allowFriendRequests")) user.setAllowFriendRequests(v);
            else if (k.equals("groupInvitesAnyone")) user.setGroupInvitesAnyone(v);
        }
        return toDTOWithAdmin(userRepository.save(user));
    }

    // == Account ==============================================================

    @CacheEvict(value = "users", key = "#id")
    public void deleteAccount(Long id, String password) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + id + "]"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Incorrect password provided for deletion confirmation");
        }
        userRepository.delete(user);
    }

    @CacheEvict(value = "users", key = "#id")
    public void adminDeleteAccount(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + id + "]"));
        userRepository.delete(user);
    }

    // == Presence =============================================================

    public void setOnline(Long id, boolean online) {
        userRepository.findById(id).ifPresent(u -> { u.setOnline(online); userRepository.save(u); });
    }

    public boolean isAppearOffline(Long id) {
        return userRepository.findById(id).map(User::isAppearOffline).orElse(false);
    }

    public Map<String, Object> getPresence(Long id) {
        return userRepository.findById(id)
                .map(u -> Map.<String, Object>of("online", u.isOnline() && !u.isAppearOffline()))
                .orElse(Map.of("online", false));
    }

    // == Internal =============================================================

    private UserDTO toDTOWithAdmin(User user) {
        UserDTO dto = UserMapper.toDTO(user);
        dto.setAdmin(adminRepository.existsByUserId(user.getId()));
        return dto;
    }

    private UserPublicDTO toPublicDTOWithAdmin(User user) {
        UserPublicDTO dto = UserMapper.toPublicDTO(user);
        dto.setAdmin(adminRepository.existsByUserId(user.getId()));
        return dto;
    }

    public boolean isAdmin(Long userId) {
        return userId != null && adminRepository.existsByUserId(userId);
    }

    private String saveFile(MultipartFile file, String prefix) {
        return r2Storage.upload(file, prefix);
    }
}
