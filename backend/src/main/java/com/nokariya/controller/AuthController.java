package com.nokariya.controller;

import com.nokariya.dto.LoginRequest;
import com.nokariya.dto.RegisterRequest;
import com.nokariya.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class AuthController {
    @Autowired
    private AuthService authService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Backend is running"));
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
            System.out.println("Login attempt for email: " + request.getEmail());
            Map<String, Object> response = authService.login(request);
            System.out.println("Login successful for: " + request.getEmail());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Login error: " + e.getMessage());
            e.printStackTrace();
            String errorMessage = e.getMessage() != null ? e.getMessage() : "Login failed";
            return ResponseEntity.status(401).body(Map.of("message", errorMessage));
        }
    }
}

