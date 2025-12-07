package com.nokariya.controller;

import com.nokariya.dto.CreateRequestDto;
import com.nokariya.model.Request;
import com.nokariya.service.RequestService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/requests")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class RequestController {
    @Autowired
    private RequestService requestService;

    private Long getUserIdFromAuthentication(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long) {
            return (Long) authentication.getPrincipal();
        }
        throw new RuntimeException("User not authenticated");
    }

    @PostMapping
    public ResponseEntity<?> createRequest(
            Authentication authentication,
            @Valid @RequestBody CreateRequestDto dto) {
        try {
            // Log the incoming request for debugging
            System.out.println("Received request creation: " + dto);
            System.out.println("Labor type requirements: " + (dto.getLaborTypeRequirements() != null ? dto.getLaborTypeRequirements().size() : "null"));
            
            Long userId = getUserIdFromAuthentication(authentication);
            Request request = requestService.createRequest(userId, dto);
            return ResponseEntity.ok(Map.of("message", "Request created successfully", "request", request));
        } catch (Exception e) {
            // Log the error for debugging
            System.err.println("Error in createRequest controller: " + e.getMessage());
            e.printStackTrace();
            String errorMessage = e.getMessage() != null ? e.getMessage() : "Failed to create request";
            return ResponseEntity.badRequest().body(Map.of("message", errorMessage, "error", e.getClass().getSimpleName()));
        }
    }

    @GetMapping("/my-requests")
    public ResponseEntity<?> getMyRequests(Authentication authentication) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Long userId = getUserIdFromAuthentication(authentication);
            List<Request> requests = requestService.getMyRequests(userId);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            System.err.println("Error fetching my requests: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Failed to fetch requests"));
        }
    }

    @GetMapping("/available")
    public ResponseEntity<?> getAvailableRequests(Authentication authentication) {
        try {
            if (authentication == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
            }
            Long userId = getUserIdFromAuthentication(authentication);
            List<Request> requests = requestService.getAvailableRequests(userId);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{requestId}/confirm")
    public ResponseEntity<?> confirmRequest(
            Authentication authentication,
            @PathVariable Long requestId) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            Request request = requestService.confirmRequest(requestId, userId);
            return ResponseEntity.ok(Map.of("message", "Request confirmed", "request", request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{requestId}/complete")
    public ResponseEntity<?> completeRequest(
            Authentication authentication,
            @PathVariable Long requestId) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            Request request = requestService.completeRequest(requestId, userId);
            return ResponseEntity.ok(Map.of("message", "Request completed", "request", request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}

