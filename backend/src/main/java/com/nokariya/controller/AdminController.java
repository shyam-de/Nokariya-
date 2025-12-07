package com.nokariya.controller;

import com.nokariya.dto.CreateUserRequest;
import com.nokariya.model.Concern;
import com.nokariya.model.ConcernMessage;
import com.nokariya.model.Request;
import com.nokariya.model.User;
import com.nokariya.service.AdminService;
import com.nokariya.service.ConcernService;
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

    @Autowired
    private ConcernService concernService;

    @GetMapping("/requests/pending")
    public ResponseEntity<?> getPendingRequests(Authentication authentication) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Long adminId = getUserIdFromAuthentication(authentication);
            List<Request> requests = adminService.getPendingApprovalRequests(adminId);
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
            
            Long adminId = getUserIdFromAuthentication(authentication);
            Object createdUser = adminService.createUser(
                    adminId,
                    request.getName(),
                    request.getEmail(),
                    request.getPhone(),
                    request.getSecondaryPhone(),
                    request.getPassword(),
                    request.getRole(),
                    request.getLocation(),
                    request.getLaborTypes(),
                    request.getIsSuperAdmin() != null ? request.getIsSuperAdmin() : false
            );

            Map<String, Object> userData = new HashMap<>();
            if (createdUser instanceof com.nokariya.model.SystemUser) {
                com.nokariya.model.SystemUser systemUser = (com.nokariya.model.SystemUser) createdUser;
                userData.put("id", systemUser.getId());
                userData.put("name", systemUser.getName());
                userData.put("email", systemUser.getEmail());
                userData.put("phone", systemUser.getPhone());
                userData.put("role", "ADMIN");
                userData.put("superAdmin", systemUser.getSuperAdmin());
            } else if (createdUser instanceof com.nokariya.model.User) {
                com.nokariya.model.User user = (com.nokariya.model.User) createdUser;
                userData.put("id", user.getId());
                userData.put("name", user.getName());
                userData.put("email", user.getEmail());
                userData.put("phone", user.getPhone());
                userData.put("role", user.getRole().name());
            }

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
            Long adminId = getUserIdFromAuthentication(authentication);
            List<Request> requests = adminService.getAllRequests(search, sortBy, sortOrder, adminId);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/concerns")
    public ResponseEntity<?> getAllConcerns(Authentication authentication) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            List<Concern> concerns = concernService.getAllConcerns();
            return ResponseEntity.ok(concerns);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/concerns/pending")
    public ResponseEntity<?> getPendingConcerns(Authentication authentication) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            List<Concern> concerns = concernService.getPendingConcerns();
            return ResponseEntity.ok(concerns);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }

        @PostMapping("/concerns/{concernId}/update-status")
        public ResponseEntity<?> updateConcernStatus(
                Authentication authentication,
                @PathVariable Long concernId,
                @RequestBody Map<String, String> request) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                String statusStr = request.get("status");
                String adminResponse = request.get("adminResponse");
                
                Concern.ConcernStatus status = Concern.ConcernStatus.valueOf(statusStr);
                Concern concern = concernService.updateConcernStatus(concernId, status, adminResponse);
                
                // If admin provided a response, add it as a message to the conversation
                if (adminResponse != null && !adminResponse.trim().isEmpty()) {
                    Long adminId = getUserIdFromAuthentication(authentication);
                    concernService.addMessageToConcern(concernId, adminId, adminResponse);
                }
                
                return ResponseEntity.ok(Map.of(
                        "message", "Concern status updated successfully",
                        "concern", concern
                ));
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
            }
        }

        @PostMapping("/concerns/{concernId}/message")
        public ResponseEntity<?> addAdminMessage(
                Authentication authentication,
                @PathVariable Long concernId,
                @RequestBody Map<String, String> request) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                String message = request.get("message");
                
                if (message == null || message.trim().isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Message is required"));
                }
                
                ConcernMessage concernMessage = concernService.addMessageToConcern(concernId, adminId, message);
                
                return ResponseEntity.ok(Map.of(
                        "message", "Message added successfully",
                        "concernMessage", concernMessage
                ));
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
            }
        }

        @GetMapping("/workers")
        public ResponseEntity<?> getAllWorkers(Authentication authentication) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                List<Map<String, Object>> workers = adminService.getAllWorkers(adminId);
                return ResponseEntity.ok(workers);
            } catch (Exception e) {
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }

        @GetMapping("/customers")
        public ResponseEntity<?> getAllCustomers(Authentication authentication) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                List<Map<String, Object>> customers = adminService.getAllCustomers(adminId);
                return ResponseEntity.ok(customers);
            } catch (Exception e) {
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }

        @PostMapping("/workers/{workerId}/toggle-verification")
        public ResponseEntity<?> toggleWorkerVerification(
                Authentication authentication,
                @PathVariable Long workerId) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                com.nokariya.model.Worker worker = adminService.toggleWorkerVerification(workerId);
                return ResponseEntity.ok(Map.of(
                        "message", "Worker verification status updated",
                        "verified", worker.getVerified()
                ));
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
            }
        }


        @GetMapping("/system-users")
        public ResponseEntity<?> getAllSystemUsers(Authentication authentication) {
            try {
                if (authentication == null) {
                    System.err.println("System users endpoint: Authentication is null");
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                System.out.println("System users endpoint: Authentication principal: " + authentication.getPrincipal());
                System.out.println("System users endpoint: Authentication authorities: " + authentication.getAuthorities());
                Long adminId = getUserIdFromAuthentication(authentication);
                System.out.println("System users endpoint: Extracted adminId: " + adminId);
                List<Map<String, Object>> systemUsers = adminService.getAllSystemUsers(adminId);
                return ResponseEntity.ok(systemUsers);
            } catch (Exception e) {
                System.err.println("System users endpoint error: " + e.getMessage());
                e.printStackTrace();
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }

        @PostMapping("/users/{userId}/toggle-block")
        public ResponseEntity<?> toggleUserBlockStatus(
                Authentication authentication,
                @PathVariable Long userId) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                User user = adminService.toggleUserBlockStatus(userId);
                return ResponseEntity.ok(Map.of(
                        "message", "User block status updated",
                        "blocked", user.getBlocked()
                ));
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
            }
        }

        private Long getUserIdFromAuthentication(Authentication authentication) {
            if (authentication != null && authentication.getPrincipal() instanceof Long) {
                return (Long) authentication.getPrincipal();
            }
            throw new RuntimeException("User not authenticated");
        }
}
