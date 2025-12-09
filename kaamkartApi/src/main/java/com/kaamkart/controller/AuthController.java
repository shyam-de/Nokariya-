package com.kaamkart.controller;

import com.kaamkart.dto.LoginRequest;
import com.kaamkart.dto.RegisterRequest;
import com.kaamkart.service.AuthService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class AuthController {
    
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    
    @Autowired
    private AuthService authService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "message", "KaamKart API is running"));
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest request) {
        try {
            Map<String, Object> response = authService.register(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest request) {
        try {
            logger.debug("Login attempt for email: {}", request.getEmail());
            Map<String, Object> response = authService.login(request);
            logger.info("Login successful for: {}", request.getEmail());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.warn("Login error for email {}: {}", request.getEmail(), e.getMessage());
            String errorMessage = e.getMessage() != null ? e.getMessage() : "Login failed";
            return ResponseEntity.status(401).body(Map.of("message", errorMessage));
        }
    }
}

