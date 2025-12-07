package com.nokariya.controller;

import com.nokariya.dto.UpdateProfileDto;
import com.nokariya.model.User;
import com.nokariya.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class ProfileController {
    @Autowired
    private ProfileService profileService;

    private Long getUserIdFromAuthentication(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long) {
            return (Long) authentication.getPrincipal();
        }
        throw new RuntimeException("User not authenticated");
    }

    @GetMapping
    public ResponseEntity<?> getProfile(Authentication authentication) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            User user = profileService.getUserProfile(userId);
            return ResponseEntity.ok(profileService.getProfileResponse(user));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping
    public ResponseEntity<?> updateProfile(
            Authentication authentication,
            @Valid @RequestBody UpdateProfileDto dto) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            User user = profileService.updateProfile(userId, dto);
            return ResponseEntity.ok(Map.of(
                    "message", "Profile updated successfully",
                    "user", profileService.getProfileResponse(user)
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}

