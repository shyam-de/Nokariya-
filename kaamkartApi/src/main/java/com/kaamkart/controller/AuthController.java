package com.kaamkart.controller;

import com.kaamkart.dto.ForgotPasswordRequest;
import com.kaamkart.dto.LoginRequest;
import com.kaamkart.dto.RegisterRequest;
import com.kaamkart.dto.ResetPasswordRequest;
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
        long startTime = System.currentTimeMillis();
        String email = request.getEmail();
        
        try {
            logger.info("🔐 LOGIN ATTEMPT | Email: {} | Timestamp: {}", email, System.currentTimeMillis());
            logger.debug("Login request received for email: {}", email);
            
            Map<String, Object> response = authService.login(request);
            
            long duration = System.currentTimeMillis() - startTime;
            Object userObj = response.get("user");
            String role = userObj != null && userObj instanceof Map ? 
                ((Map<?, ?>) userObj).get("role").toString() : "UNKNOWN";
            
            logger.info("✅ LOGIN SUCCESS | Email: {} | Role: {} | Duration: {}ms", email, role, duration);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("❌ LOGIN FAILED | Email: {} | Error: {} | Duration: {}ms", 
                    email, e.getMessage(), duration, e);
            String errorMessage = e.getMessage() != null ? e.getMessage() : "Login failed";
            return ResponseEntity.status(401).body(Map.of("message", errorMessage));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        long startTime = System.currentTimeMillis();
        String email = request.getEmail();
        
        try {
            logger.info("🔑 FORGOT PASSWORD REQUEST | Email: {}", email);
            Map<String, Object> response = authService.forgotPassword(request);
            long duration = System.currentTimeMillis() - startTime;
            logger.info("✅ FORGOT PASSWORD SUCCESS | Email: {} | Duration: {}ms", email, duration);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("❌ FORGOT PASSWORD FAILED | Email: {} | Error: {} | Duration: {}ms", 
                    email, e.getMessage(), duration, e);
            // Always return success message (security best practice - don't reveal if user exists)
            return ResponseEntity.ok(Map.of("message", "If an account exists with this email, a password reset link has been sent."));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        long startTime = System.currentTimeMillis();
        
        try {
            logger.info("🔐 RESET PASSWORD REQUEST | Token: {}...", 
                    request.getToken().substring(0, Math.min(10, request.getToken().length())));
            Map<String, Object> response = authService.resetPassword(request);
            long duration = System.currentTimeMillis() - startTime;
            logger.info("✅ RESET PASSWORD SUCCESS | Duration: {}ms", duration);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("❌ RESET PASSWORD FAILED | Error: {} | Duration: {}ms", 
                    e.getMessage(), duration, e);
            String errorMessage = e.getMessage() != null ? e.getMessage() : "Password reset failed";
            return ResponseEntity.badRequest().body(Map.of("message", errorMessage));
        }
    }
}

