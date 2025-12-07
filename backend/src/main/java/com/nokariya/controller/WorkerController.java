package com.nokariya.controller;

import com.nokariya.dto.LocationDto;
import com.nokariya.model.Worker;
import com.nokariya.service.WorkerService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/workers")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class WorkerController {
    @Autowired
    private WorkerService workerService;

    private Long getUserIdFromAuthentication(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long) {
            return (Long) authentication.getPrincipal();
        }
        throw new RuntimeException("User not authenticated");
    }

    @GetMapping("/profile")
    public ResponseEntity<Worker> getWorkerProfile(Authentication authentication) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            Worker worker = workerService.getWorkerProfile(userId);
            return ResponseEntity.ok(worker);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/location")
    public ResponseEntity<?> updateLocation(
            Authentication authentication,
            @Valid @RequestBody LocationDto locationDto) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            Worker worker = workerService.updateLocation(userId, locationDto);
            return ResponseEntity.ok(Map.of("message", "Location updated", "location", worker.getCurrentLocation()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/availability")
    public ResponseEntity<?> updateAvailability(
            Authentication authentication,
            @RequestBody Map<String, Boolean> request) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            Boolean available = request.get("available");
            Worker worker = workerService.updateAvailability(userId, available);
            return ResponseEntity.ok(Map.of("message", "Availability updated", "available", worker.getAvailable()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> getWorkHistory(Authentication authentication) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            List<Map<String, Object>> history = workerService.getWorkHistory(userId);
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/profile/update")
    public ResponseEntity<?> updateWorkerProfile(
            Authentication authentication,
            @Valid @RequestBody com.nokariya.dto.UpdateProfileDto dto) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            com.nokariya.model.User user = workerService.updateWorkerProfile(userId, dto);
            Map<String, Object> userData = new java.util.HashMap<>();
            userData.put("id", user.getId());
            userData.put("name", user.getName());
            userData.put("email", user.getEmail());
            userData.put("phone", user.getPhone());
            userData.put("role", user.getRole().name());
            userData.put("location", user.getLocation());
            return ResponseEntity.ok(Map.of(
                    "message", "Profile updated successfully",
                    "user", userData
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}

