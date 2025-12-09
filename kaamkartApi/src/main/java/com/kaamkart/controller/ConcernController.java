package com.kaamkart.controller;

import com.kaamkart.dto.CreateConcernDto;
import com.kaamkart.model.Concern;
import com.kaamkart.model.ConcernMessage;
import com.kaamkart.service.ConcernService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/concerns")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class ConcernController {
    
    private static final Logger logger = LoggerFactory.getLogger(ConcernController.class);
    
    @Autowired
    private ConcernService concernService;

    private Long getUserIdFromAuthentication(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long) {
            return (Long) authentication.getPrincipal();
        }
        throw new RuntimeException("User not authenticated");
    }

    @PostMapping
    public ResponseEntity<?> createConcern(
            Authentication authentication,
            @Valid @RequestBody CreateConcernDto dto) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            Concern concern = concernService.createConcern(userId, dto);
            return ResponseEntity.ok(Map.of(
                    "message", "Concern submitted successfully",
                    "concern", concern
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/my-concerns")
    public ResponseEntity<?> getMyConcerns(Authentication authentication) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            List<Concern> concerns = concernService.getConcernsByUser(userId);
            return ResponseEntity.ok(concerns);
        } catch (Exception e) {
            logger.error("Error fetching my concerns for user {}: {}", 
                    getUserIdFromAuthentication(authentication), e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Failed to fetch concerns"));
        }
    }

    @PutMapping("/{concernId}/status")
    public ResponseEntity<?> updateConcernStatus(
            Authentication authentication,
            @PathVariable Long concernId,
            @RequestBody Map<String, String> request) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            String statusStr = request.get("status");
            String message = request.get("message"); // Optional message
            
            if (statusStr == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Status is required"));
            }
            
            Concern.ConcernStatus status = Concern.ConcernStatus.valueOf(statusStr);
            Concern concern = concernService.updateConcernStatusByUser(concernId, userId, status, message);
            
            return ResponseEntity.ok(Map.of(
                    "message", "Concern updated successfully",
                    "concern", concern
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid status"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{concernId}/message")
    public ResponseEntity<?> addMessage(
            Authentication authentication,
            @PathVariable Long concernId,
            @RequestBody Map<String, String> request) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            String message = request.get("message");
            
            if (message == null || message.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Message is required"));
            }
            
            ConcernMessage concernMessage = concernService.addMessageToConcern(concernId, userId, message);
            
            return ResponseEntity.ok(Map.of(
                    "message", "Message added successfully",
                    "concernMessage", concernMessage
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/{concernId}/messages")
    public ResponseEntity<?> getConcernMessages(
            Authentication authentication,
            @PathVariable Long concernId) {
        try {
            List<ConcernMessage> messages = concernService.getConcernMessages(concernId);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}

