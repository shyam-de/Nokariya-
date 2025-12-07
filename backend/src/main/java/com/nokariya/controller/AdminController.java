package com.nokariya.controller;

import com.nokariya.dto.CreateUserRequest;
import com.nokariya.model.Request;
import com.nokariya.model.User;
import com.nokariya.service.AdminService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @GetMapping("/requests/pending")
    public ResponseEntity<?> getPendingRequests(Authentication authentication) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            List<Request> requests = adminService.getPendingApprovalRequests();
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/requests/{requestId}/approve")
    public ResponseEntity<?> approveRequest(
            Authentication authentication,
            @PathVariable Long requestId) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Request request = adminService.approveRequest(requestId);
            return ResponseEntity.ok(Map.of("message", "Request approved and workers notified", "request", request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<?> rejectRequest(
            Authentication authentication,
            @PathVariable Long requestId) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Request request = adminService.rejectRequest(requestId);
            return ResponseEntity.ok(Map.of("message", "Request rejected", "request", request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/users/create")
    public ResponseEntity<?> createUser(
            Authentication authentication,
            @Valid @RequestBody CreateUserRequest request) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            
            User user = adminService.createUser(
                    request.getName(),
                    request.getEmail(),
                    request.getPhone(),
                    request.getPassword(),
                    request.getRole(),
                    request.getLocation(),
                    request.getLaborTypes()
            );

            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getId());
            userData.put("name", user.getName());
            userData.put("email", user.getEmail());
            userData.put("phone", user.getPhone());
            userData.put("role", user.getRole().name());

            return ResponseEntity.ok(Map.of(
                    "message", "User created successfully",
                    "user", userData
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetAdminPassword(
            @RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            String password = request.get("password");
            
            if (email == null || password == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Email and password are required"));
            }
            
            User user = adminService.updateAdminPassword(email, password);
            return ResponseEntity.ok(Map.of("message", "Password updated successfully", "email", user.getEmail()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/requests/all")
    public ResponseEntity<?> getAllRequests(
            Authentication authentication,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            List<Request> requests = adminService.getAllRequests(search, sortBy, sortOrder);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }
}
