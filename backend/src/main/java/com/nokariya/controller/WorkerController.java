package com.nokariya.controller;

import com.nokariya.dto.LocationDto;
import com.nokariya.model.Worker;
import com.nokariya.service.WorkerService;
import com.nokariya.util.JwtUtil;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/workers")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class WorkerController {
    @Autowired
    private WorkerService workerService;

    @Autowired
    private JwtUtil jwtUtil;

    @GetMapping("/profile")
    public ResponseEntity<Worker> getWorkerProfile(@RequestHeader("Authorization") String token) {
        String jwt = token.replace("Bearer ", "");
        Long userId = jwtUtil.getUserIdFromToken(jwt);
        Worker worker = workerService.getWorkerProfile(userId);
        return ResponseEntity.ok(worker);
    }

    @PutMapping("/location")
    public ResponseEntity<?> updateLocation(
            @RequestHeader("Authorization") String token,
            @Valid @RequestBody LocationDto locationDto) {
        try {
            String jwt = token.replace("Bearer ", "");
            Long userId = jwtUtil.getUserIdFromToken(jwt);
            Worker worker = workerService.updateLocation(userId, locationDto);
            return ResponseEntity.ok(Map.of("message", "Location updated", "location", worker.getCurrentLocation()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/availability")
    public ResponseEntity<?> updateAvailability(
            @RequestHeader("Authorization") String token,
            @RequestBody Map<String, Boolean> request) {
        try {
            String jwt = token.replace("Bearer ", "");
            Long userId = jwtUtil.getUserIdFromToken(jwt);
            Boolean available = request.get("available");
            Worker worker = workerService.updateAvailability(userId, available);
            return ResponseEntity.ok(Map.of("message", "Availability updated", "available", worker.getAvailable()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}

