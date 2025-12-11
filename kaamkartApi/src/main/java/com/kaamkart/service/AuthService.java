package com.kaamkart.service;

import com.kaamkart.dto.ForgotPasswordRequest;
import com.kaamkart.dto.LoginRequest;
import com.kaamkart.dto.RegisterRequest;
import com.kaamkart.dto.ResetPasswordRequest;
import com.kaamkart.model.Location;
import com.kaamkart.model.PasswordResetToken;
import com.kaamkart.model.Rating;
import com.kaamkart.model.User;
import com.kaamkart.model.Worker;
import com.kaamkart.model.SystemUser;
import com.kaamkart.repository.PasswordResetTokenRepository;
import com.kaamkart.repository.RatingRepository;
import com.kaamkart.repository.SystemUserRepository;
import com.kaamkart.repository.UserRepository;
import com.kaamkart.repository.WorkerRepository;
import com.kaamkart.util.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {
    
    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);
    
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RatingRepository ratingRepository;

    @Autowired
    private SystemUserRepository systemUserRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Transactional
    public Map<String, Object> register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("User already exists");
        }

        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setSecondaryPhone(request.getSecondaryPhone());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());

        if (request.getLocation() != null) {
            Location location = new Location();
            location.setLatitude(request.getLocation().getLatitude());
            location.setLongitude(request.getLocation().getLongitude());
            location.setAddress(request.getLocation().getAddress());
            user.setLocation(location);
        }

        user = userRepository.save(user);

        // If worker, create worker profile
        if (user.getRole() == User.UserRole.WORKER && request.getWorkerTypes() != null) {
            Worker worker = new Worker();
            worker.setUser(user);
            worker.setWorkerTypes(request.getWorkerTypes());
            if (request.getLocation() != null) {
                Location currentLocation = new Location();
                currentLocation.setLatitude(request.getLocation().getLatitude());
                currentLocation.setLongitude(request.getLocation().getLongitude());
                currentLocation.setAddress(request.getLocation().getAddress());
                worker.setCurrentLocation(currentLocation);
            }
            workerRepository.save(worker);
        }

        String token = jwtUtil.generateToken(user.getId(), user.getRole().name());

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        Map<String, Object> userData = buildUserDataWithRating(user);
        response.put("user", userData);

        return response;
    }

    public Map<String, Object> login(LoginRequest request) {
        try {
            if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
                throw new RuntimeException("Email is required");
            }
            if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
                throw new RuntimeException("Password is required");
            }

            // First try to find in SystemUser table (for admins)
            Optional<SystemUser> systemUserOpt = systemUserRepository.findByEmail(request.getEmail().trim().toLowerCase());
            if (systemUserOpt.isPresent()) {
                SystemUser systemUser = systemUserOpt.get();
                
                if (!passwordEncoder.matches(request.getPassword(), systemUser.getPassword())) {
                    throw new RuntimeException("Invalid credentials");
                }

                // Check if system user is blocked
                if (systemUser.getBlocked() != null && systemUser.getBlocked()) {
                    throw new RuntimeException("Your account has been blocked. Please contact administrator.");
                }

                // Generate token with negative ID to distinguish from regular users
                // Use -id for system users, prefix with "SYSTEM_" for role
                String token = jwtUtil.generateToken(-systemUser.getId(), "SYSTEM_ADMIN");

                Map<String, Object> response = new HashMap<>();
                response.put("token", token);
                Map<String, Object> userData = buildSystemUserData(systemUser);
                response.put("user", userData);

                return response;
            }

            // If not found in SystemUser, check regular User table
            User user = userRepository.findByEmail(request.getEmail().trim().toLowerCase())
                    .orElseThrow(() -> new RuntimeException("Invalid credentials"));

            if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                throw new RuntimeException("Invalid credentials");
            }

            // Check if user is blocked
            if (user.getBlocked() != null && user.getBlocked()) {
                throw new RuntimeException("Your account has been blocked. Please contact administrator.");
            }

            String token = jwtUtil.generateToken(user.getId(), user.getRole().name());

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            Map<String, Object> userData = buildUserDataWithRating(user);
            response.put("user", userData);

            return response;
        } catch (RuntimeException e) {
            // Re-throw runtime exceptions as-is
            throw e;
        } catch (Exception e) {
            logger.error("Unexpected error during login: {}", e.getMessage(), e);
            throw new RuntimeException("Login failed: " + e.getMessage(), e);
        }
    }

    private Map<String, Object> buildSystemUserData(SystemUser systemUser) {
        Map<String, Object> userData = new HashMap<>();
        userData.put("id", systemUser.getId());
        userData.put("name", systemUser.getName());
        userData.put("email", systemUser.getEmail());
        userData.put("phone", systemUser.getPhone());
        userData.put("secondaryPhone", systemUser.getSecondaryPhone());
        userData.put("role", "ADMIN");
        userData.put("superAdmin", systemUser.getSuperAdmin() != null ? systemUser.getSuperAdmin() : false);
        userData.put("location", systemUser.getLocation());
        userData.put("rating", 0.0);
        userData.put("totalRatings", 0);
        return userData;
    }

    private Map<String, Object> buildUserDataWithRating(User user) {
        Map<String, Object> userData = new HashMap<>();
        userData.put("id", user.getId());
        userData.put("name", user.getName());
        userData.put("email", user.getEmail());
        userData.put("role", user.getRole().name());
        
        // Add superAdmin flag for admin users
        if (user.getRole() == User.UserRole.ADMIN) {
            userData.put("superAdmin", user.getSuperAdmin() != null ? user.getSuperAdmin() : false);
        }
        
        // Calculate and add rating
        Double rating = calculateUserRating(user);
        userData.put("rating", rating);
        userData.put("totalRatings", getTotalRatingsCount(user));
        
        return userData;
    }

    private Double calculateUserRating(User user) {
        if (user.getRole() == User.UserRole.WORKER) {
            // For workers, get rating from Worker table
            Optional<Worker> workerOpt = workerRepository.findByUserId(user.getId());
            if (workerOpt.isPresent()) {
                Double workerRating = workerOpt.get().getRating();
                return workerRating != null ? workerRating : 0.0;
            }
        }
        
        // For customers (or if worker profile not found), calculate from ratings table
        List<Rating> ratings = ratingRepository.findByRated(user);
        if (ratings.isEmpty()) {
            return 0.0;
        }
        
        double averageRating = ratings.stream()
                .mapToInt(Rating::getRating)
                .average()
                .orElse(0.0);
        
        return Math.round(averageRating * 10.0) / 10.0;
    }

    private Integer getTotalRatingsCount(User user) {
        List<Rating> ratings = ratingRepository.findByRated(user);
        return ratings.size();
    }

    /**
     * Generate password reset token for forgot password
     */
    @Transactional
    public Map<String, Object> forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        logger.info("🔑 FORGOT PASSWORD REQUEST | Email: {}", email);

        // Check if user exists (regular user or system user)
        Optional<User> userOpt = userRepository.findByEmail(email);
        Optional<SystemUser> systemUserOpt = systemUserRepository.findByEmail(email);

        if (userOpt.isEmpty() && systemUserOpt.isEmpty()) {
            // Don't reveal if user exists or not (security best practice)
            logger.warn("⚠️ FORGOT PASSWORD | Email not found: {}", email);
            return Map.of("message", "If an account exists with this email, a password reset link has been sent.");
        }

        Long userId;
        Boolean isSystemUser;
        String userName;

        if (systemUserOpt.isPresent()) {
            SystemUser systemUser = systemUserOpt.get();
            userId = systemUser.getId();
            isSystemUser = true;
            userName = systemUser.getName();
        } else {
            User user = userOpt.get();
            userId = user.getId();
            isSystemUser = false;
            userName = user.getName();
        }

        // Invalidate all existing tokens for this user
        passwordResetTokenRepository.invalidateAllTokensForUser(userId, isSystemUser);

        // Generate secure token
        String token = generateSecureToken();

        // Create reset token (valid for 1 hour)
        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setToken(token);
        resetToken.setUserId(userId);
        resetToken.setIsSystemUser(isSystemUser);
        resetToken.setExpiresAt(LocalDateTime.now().plusHours(1));
        resetToken.setUsed(false);
        passwordResetTokenRepository.save(resetToken);

        logger.info("✅ PASSWORD RESET TOKEN CREATED | User: {} | Email: {} | Token: {}", 
                userId, email, token.substring(0, 10) + "...");

        // TODO: Send email with reset link
        // For now, return token in response (in production, send via email)
        // Format: /reset-password?token=TOKEN
        String resetLink = "/reset-password?token=" + token;

        return Map.of(
            "message", "If an account exists with this email, a password reset link has been sent.",
            "token", token, // Remove this in production - only for testing
            "resetLink", resetLink, // Remove this in production - only for testing
            "expiresIn", "1 hour"
        );
    }

    /**
     * Reset password using token
     */
    @Transactional
    public Map<String, Object> resetPassword(ResetPasswordRequest request) {
        String token = request.getToken().trim();
        String newPassword = request.getNewPassword();

        logger.info("🔐 RESET PASSWORD REQUEST | Token: {}...", token.substring(0, Math.min(10, token.length())));

        // Find token
        Optional<PasswordResetToken> tokenOpt = passwordResetTokenRepository.findByTokenAndUsedFalse(token);
        if (tokenOpt.isEmpty()) {
            logger.warn("❌ RESET PASSWORD FAILED | Invalid or used token");
            throw new RuntimeException("Invalid or expired reset token");
        }

        PasswordResetToken resetToken = tokenOpt.get();

        // Check if token is valid
        if (!resetToken.isValid()) {
            logger.warn("❌ RESET PASSWORD FAILED | Token expired");
            throw new RuntimeException("Reset token has expired. Please request a new one.");
        }

        // Check if token is already used
        if (resetToken.getUsed()) {
            logger.warn("❌ RESET PASSWORD FAILED | Token already used");
            throw new RuntimeException("Reset token has already been used. Please request a new one.");
        }

        // Update password
        String encodedPassword = passwordEncoder.encode(newPassword);
        
        if (resetToken.getIsSystemUser()) {
            SystemUser systemUser = systemUserRepository.findById(resetToken.getUserId())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            systemUser.setPassword(encodedPassword);
            systemUserRepository.save(systemUser);
            logger.info("✅ PASSWORD RESET SUCCESS | SystemUser: {} | Email: {}", 
                    resetToken.getUserId(), systemUser.getEmail());
        } else {
            User user = userRepository.findById(resetToken.getUserId())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            user.setPassword(encodedPassword);
            userRepository.save(user);
            logger.info("✅ PASSWORD RESET SUCCESS | User: {} | Email: {}", 
                    resetToken.getUserId(), user.getEmail());
        }

        // Mark token as used
        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        return Map.of("message", "Password has been reset successfully. You can now login with your new password.");
    }

    /**
     * Generate secure random token
     */
    private String generateSecureToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}

