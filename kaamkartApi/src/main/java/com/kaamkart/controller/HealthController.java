package com.kaamkart.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {
    
    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("timestamp", LocalDateTime.now());
        health.put("service", "KaamKart API");
        health.put("version", "1.0.0");
        return ResponseEntity.ok(health);
    }
    
    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> readiness() {
        Map<String, Object> ready = new HashMap<>();
        ready.put("status", "READY");
        ready.put("timestamp", LocalDateTime.now());
        return ResponseEntity.ok(ready);
    }
    
    @GetMapping("/live")
    public ResponseEntity<Map<String, Object>> liveness() {
        Map<String, Object> live = new HashMap<>();
        live.put("status", "ALIVE");
        live.put("timestamp", LocalDateTime.now());
        return ResponseEntity.ok(live);
    }
}

