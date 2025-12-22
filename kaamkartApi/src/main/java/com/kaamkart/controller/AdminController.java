package com.kaamkart.controller;

import com.kaamkart.dto.CreateUserRequest;
import com.kaamkart.model.*;
import com.kaamkart.service.AdminService;
import com.kaamkart.service.AdvertisementService;
import com.kaamkart.service.ConcernService;
import com.kaamkart.service.WorkerTypeService;
import com.kaamkart.service.SuccessStoryService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger logger = LoggerFactory.getLogger(AdminController.class);

    @Autowired
    private AdminService adminService;

    @Autowired
    private ConcernService concernService;

    @Autowired
    private SuccessStoryService successStoryService;

    @Autowired
    private AdvertisementService advertisementService;

    @Autowired
    private WorkerTypeService workerTypeService;

    @GetMapping("/requests/pending")
    public ResponseEntity<?> getPendingRequests(
            Authentication authentication,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(required = false) Boolean locationFilter) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Long adminId = getUserIdFromAuthentication(authentication);
            List<Request> requests = adminService.getPendingApprovalRequests(adminId, search, sortBy, sortOrder, locationFilter);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/requests/active")
    public ResponseEntity<?> getActiveRequests(
            Authentication authentication,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(required = false) Boolean locationFilter) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Long adminId = getUserIdFromAuthentication(authentication);
            List<Request> requests = adminService.getActiveRequests(adminId, search, sortBy, sortOrder, locationFilter);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/requests/{requestId}/approve")
    public ResponseEntity<?> approveRequest(
            Authentication authentication,
            @PathVariable Long requestId) {
        long startTime = System.currentTimeMillis();
        
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Long adminId = getUserIdFromAuthentication(authentication);
            logger.info("✅ APPROVE REQUEST | RequestID: {} | Admin: {} | Timestamp: {}", 
                    requestId, adminId, System.currentTimeMillis());
            
            Request request = adminService.approveRequest(requestId);
            
            long duration = System.currentTimeMillis() - startTime;
            logger.info("✅ REQUEST APPROVED | RequestID: {} | Admin: {} | Duration: {}ms", 
                    requestId, adminId, duration);
            
            return ResponseEntity.ok(Map.of("message", "Request approved and workers notified", "request", request));
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("❌ REQUEST APPROVAL FAILED | RequestID: {} | Error: {} | Duration: {}ms", 
                    requestId, e.getMessage(), duration, e);
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<?> rejectRequest(
            Authentication authentication,
            @PathVariable Long requestId) {
        long startTime = System.currentTimeMillis();
        
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Long adminId = getUserIdFromAuthentication(authentication);
            logger.info("❌ REJECT REQUEST | RequestID: {} | Admin: {} | Timestamp: {}", 
                    requestId, adminId, System.currentTimeMillis());
            
            Request request = adminService.rejectRequest(requestId);
            
            long duration = System.currentTimeMillis() - startTime;
            logger.info("✅ REQUEST REJECTED | RequestID: {} | Admin: {} | Duration: {}ms", 
                    requestId, adminId, duration);
            
            return ResponseEntity.ok(Map.of("message", "Request rejected", "request", request));
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("❌ REQUEST REJECTION FAILED | RequestID: {} | Error: {} | Duration: {}ms", 
                    requestId, e.getMessage(), duration, e);
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/requests/{requestId}/confirmation-status")
    public ResponseEntity<?> getConfirmationStatus(
            Authentication authentication,
            @PathVariable Long requestId) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Map<String, Object> status = adminService.getRequestConfirmationStatus(requestId);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/requests/{requestId}/deploy")
    public ResponseEntity<?> deployWorkers(
            Authentication authentication,
            @PathVariable Long requestId) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Request request = adminService.deployWorkers(requestId);
            return ResponseEntity.ok(Map.of("message", "Workers deployed successfully", "request", request));
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
                    request.getWorkerTypes(),
                    request.getIsSuperAdmin() != null ? request.getIsSuperAdmin() : false
            );

            Map<String, Object> userData = new HashMap<>();
            if (createdUser instanceof com.kaamkart.model.SystemUser) {
                com.kaamkart.model.SystemUser systemUser = (com.kaamkart.model.SystemUser) createdUser;
                userData.put("id", systemUser.getId());
                userData.put("name", systemUser.getName());
                userData.put("email", systemUser.getEmail());
                userData.put("phone", systemUser.getPhone());
                userData.put("role", "ADMIN");
                userData.put("superAdmin", systemUser.getSuperAdmin());
            } else if (createdUser instanceof com.kaamkart.model.User) {
                com.kaamkart.model.User user = (com.kaamkart.model.User) createdUser;
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

    /**
     * Update system user (admin) - super admin status and/or password
     * Only super admin can perform this operation
     */
    @PutMapping("/system-users/{id}")
    public ResponseEntity<?> updateSystemUser(
            Authentication authentication,
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            
            Long adminId = getUserIdFromAuthentication(authentication);
            if (!adminService.isSuperAdmin(adminId)) {
                return ResponseEntity.status(403).body(Map.of("message", "Only super admin can update system users"));
            }
            
            Boolean superAdmin = request.get("superAdmin") != null ? 
                    Boolean.valueOf(request.get("superAdmin").toString()) : null;
            String newPassword = request.get("newPassword") != null ? 
                    request.get("newPassword").toString() : null;
            
            SystemUser updated = adminService.updateSystemUser(adminId, id, superAdmin, newPassword);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "System user updated successfully");
            response.put("id", updated.getId());
            response.put("name", updated.getName());
            response.put("email", updated.getEmail());
            response.put("superAdmin", updated.getSuperAdmin());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error updating system user", e);
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * Update customer or worker password
     * Only super admin can perform this operation
     */
    @PutMapping("/users/{id}/password")
    public ResponseEntity<?> updateUserPassword(
            Authentication authentication,
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            
            Long adminId = getUserIdFromAuthentication(authentication);
            if (!adminService.isSuperAdmin(adminId)) {
                return ResponseEntity.status(403).body(Map.of("message", "Only super admin can update user passwords"));
            }
            
            String newPassword = request.get("newPassword");
            if (newPassword == null || newPassword.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Password is required"));
            }
            
            User updated = adminService.updateUserPassword(adminId, id, newPassword);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Password updated successfully");
            response.put("id", updated.getId());
            response.put("email", updated.getEmail());
            response.put("role", updated.getRole().name());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error updating user password", e);
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
    public ResponseEntity<?> getAllConcerns(
            Authentication authentication,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(required = false) Boolean locationFilter) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Long adminId = getUserIdFromAuthentication(authentication);
            List<Concern> concerns = concernService.getAllConcerns(adminId, search, sortBy, sortOrder, locationFilter);
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
            Long adminId = getUserIdFromAuthentication(authentication);
            List<Concern> concerns = concernService.getPendingConcerns(adminId);
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
                // Both system users and regular admins can now add messages
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
                
                // System users and regular admins can both add messages now
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
        public ResponseEntity<?> getAllWorkers(
                Authentication authentication,
                @RequestParam(required = false) String search,
                @RequestParam(required = false) String sortBy,
                @RequestParam(required = false) String sortOrder,
                @RequestParam(required = false) Boolean locationFilter) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                List<Map<String, Object>> workers = adminService.getAllWorkers(adminId, search, sortBy, sortOrder, locationFilter);
                return ResponseEntity.ok(workers);
            } catch (Exception e) {
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }

        @GetMapping("/customers")
        public ResponseEntity<?> getAllCustomers(
                Authentication authentication,
                @RequestParam(required = false) String search,
                @RequestParam(required = false) String sortBy,
                @RequestParam(required = false) String sortOrder,
                @RequestParam(required = false) Boolean locationFilter) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                List<Map<String, Object>> customers = adminService.getAllCustomers(adminId, search, sortBy, sortOrder, locationFilter);
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
                com.kaamkart.model.Worker worker = adminService.toggleWorkerVerification(workerId);
                return ResponseEntity.ok(Map.of(
                        "message", "Worker verification status updated",
                        "verified", worker.getVerified()
                ));
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
            }
        }


        @GetMapping("/system-users")
        public ResponseEntity<?> getAllSystemUsers(
                Authentication authentication,
                @RequestParam(required = false) String search,
                @RequestParam(required = false) String sortBy,
                @RequestParam(required = false) String sortOrder,
                @RequestParam(required = false) Boolean locationFilter) {
            try {
                if (authentication == null) {
                    logger.warn("System users endpoint: Authentication is null");
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                logger.debug("System users endpoint: Authentication principal: {}, authorities: {}", 
                        authentication.getPrincipal(), authentication.getAuthorities());
                Long adminId = getUserIdFromAuthentication(authentication);
                logger.debug("System users endpoint: Extracted adminId: {}", adminId);
                List<Map<String, Object>> systemUsers = adminService.getAllSystemUsers(adminId, search, sortBy, sortOrder, locationFilter);
                return ResponseEntity.ok(systemUsers);
            } catch (Exception e) {
                logger.error("System users endpoint error: {}", e.getMessage(), e);
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

        // ========== Success Stories Management (Super Admin Only) ==========
        
        @GetMapping("/success-stories")
        public ResponseEntity<?> getAllSuccessStories(Authentication authentication) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can access this"));
                }
                List<SuccessStory> stories = successStoryService.getAllStories();
                return ResponseEntity.ok(stories);
            } catch (Exception e) {
                logger.error("Error fetching success stories", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        @PostMapping("/success-stories")
        public ResponseEntity<?> createSuccessStory(
                Authentication authentication,
                @RequestBody SuccessStory story) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can create success stories"));
                }
                SuccessStory created = successStoryService.createStory(story);
                return ResponseEntity.ok(created);
            } catch (Exception e) {
                logger.error("Error creating success story", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        @PutMapping("/success-stories/{id}")
        public ResponseEntity<?> updateSuccessStory(
                Authentication authentication,
                @PathVariable Long id,
                @RequestBody SuccessStory story) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can update success stories"));
                }
                SuccessStory updated = successStoryService.updateStory(id, story);
                return ResponseEntity.ok(updated);
            } catch (Exception e) {
                logger.error("Error updating success story", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        @DeleteMapping("/success-stories/{id}")
        public ResponseEntity<?> deleteSuccessStory(
                Authentication authentication,
                @PathVariable Long id) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can delete success stories"));
                }
                successStoryService.deleteStory(id);
                return ResponseEntity.ok(Map.of("message", "Success story deleted successfully"));
            } catch (Exception e) {
                logger.error("Error deleting success story", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        // ========== Advertisement Management (Super Admin Only) ==========
        
        @GetMapping("/advertisements")
        public ResponseEntity<?> getAllAdvertisements(Authentication authentication) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can access this"));
                }
                List<Advertisement> ads = advertisementService.getAllAdvertisements();
                return ResponseEntity.ok(ads);
            } catch (Exception e) {
                logger.error("Error fetching advertisements", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        @PostMapping("/advertisements")
        public ResponseEntity<?> createAdvertisement(
                Authentication authentication,
                @RequestBody Advertisement advertisement) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can create advertisements"));
                }
                Advertisement created = advertisementService.createAdvertisement(advertisement);
                return ResponseEntity.ok(created);
            } catch (Exception e) {
                logger.error("Error creating advertisement", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        @PutMapping("/advertisements/{id}")
        public ResponseEntity<?> updateAdvertisement(
                Authentication authentication,
                @PathVariable Long id,
                @RequestBody Advertisement advertisement) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can update advertisements"));
                }
                Advertisement updated = advertisementService.updateAdvertisement(id, advertisement);
                return ResponseEntity.ok(updated);
            } catch (Exception e) {
                logger.error("Error updating advertisement", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        @DeleteMapping("/advertisements/{id}")
        public ResponseEntity<?> deleteAdvertisement(
                Authentication authentication,
                @PathVariable Long id) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can delete advertisements"));
                }
                advertisementService.deleteAdvertisement(id);
                return ResponseEntity.ok(Map.of("message", "Advertisement deleted successfully"));
            } catch (Exception e) {
                logger.error("Error deleting advertisement", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }

        // ========== Labor Type Management (Super Admin Only) ==========
        
        @GetMapping("/worker-types")
        public ResponseEntity<?> getAllWorkerTypes(Authentication authentication) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can access this"));
                }
                List<WorkerType> workerTypes = workerTypeService.getAllWorkerTypes();
                return ResponseEntity.ok(workerTypes);
            } catch (Exception e) {
                logger.error("Error fetching worker types", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        @PostMapping("/worker-types")
        public ResponseEntity<?> createWorkerType(
                Authentication authentication,
                @RequestBody WorkerType workerType) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can create worker types"));
                }
                WorkerType created = workerTypeService.createWorkerType(workerType);
                return ResponseEntity.ok(created);
            } catch (Exception e) {
                logger.error("Error creating worker type", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        @PutMapping("/worker-types/{id}")
        public ResponseEntity<?> updateWorkerType(
                Authentication authentication,
                @PathVariable Long id,
                @RequestBody WorkerType workerType) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can update worker types"));
                }
                WorkerType updated = workerTypeService.updateWorkerType(id, workerType);
                return ResponseEntity.ok(updated);
            } catch (Exception e) {
                logger.error("Error updating worker type", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        @DeleteMapping("/worker-types/{id}")
        public ResponseEntity<?> deleteWorkerType(
                Authentication authentication,
                @PathVariable Long id) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can delete worker types"));
                }
                workerTypeService.deleteWorkerType(id);
                return ResponseEntity.ok(Map.of("message", "Worker type deleted successfully"));
            } catch (Exception e) {
                logger.error("Error deleting worker type", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }
        
        @PostMapping("/worker-types/{id}/toggle-active")
        public ResponseEntity<?> toggleWorkerTypeActive(
                Authentication authentication,
                @PathVariable Long id) {
            try {
                if (authentication == null) {
                    return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
                }
                Long adminId = getUserIdFromAuthentication(authentication);
                if (!adminService.isSuperAdmin(adminId)) {
                    return ResponseEntity.status(403).body(Map.of("message", "Only super admin can toggle worker type status"));
                }
                WorkerType updated = workerTypeService.toggleActiveStatus(id);
                return ResponseEntity.ok(updated);
            } catch (Exception e) {
                logger.error("Error toggling worker type status", e);
                return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
            }
        }

        private Long getUserIdFromAuthentication(Authentication authentication) {
            if (authentication != null && authentication.getPrincipal() instanceof Long) {
                return (Long) authentication.getPrincipal();
            }
            throw new RuntimeException("User not authenticated");
        }
}
