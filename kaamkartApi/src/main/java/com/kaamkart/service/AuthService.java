package com.kaamkart.service;

import com.kaamkart.dto.LoginRequest;
import com.kaamkart.dto.RegisterRequest;
import com.kaamkart.model.Location;
import com.kaamkart.model.Rating;
import com.kaamkart.model.User;
import com.kaamkart.model.Worker;
import com.kaamkart.model.SystemUser;
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
        if (user.getRole() == User.UserRole.WORKER && request.getLaborTypes() != null) {
            Worker worker = new Worker();
            worker.setUser(user);
            worker.setLaborTypes(request.getLaborTypes());
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
}

