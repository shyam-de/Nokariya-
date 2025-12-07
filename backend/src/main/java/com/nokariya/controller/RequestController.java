package com.nokariya.controller;

import com.nokariya.dto.CreateRequestDto;
import com.nokariya.model.Request;
import com.nokariya.service.RequestService;
import com.nokariya.util.JwtUtil;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/requests")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class RequestController {
    @Autowired
    private RequestService requestService;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping
    public ResponseEntity<?> createRequest(
            @RequestHeader("Authorization") String token,
            @Valid @RequestBody CreateRequestDto dto) {
        try {
            String jwt = token.replace("Bearer ", "");
            Long userId = jwtUtil.getUserIdFromToken(jwt);
            Request request = requestService.createRequest(userId, dto);
            return ResponseEntity.ok(Map.of("message", "Request created and workers notified", "request", request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/my-requests")
    public ResponseEntity<List<Request>> getMyRequests(@RequestHeader("Authorization") String token) {
        String jwt = token.replace("Bearer ", "");
        Long userId = jwtUtil.getUserIdFromToken(jwt);
        List<Request> requests = requestService.getMyRequests(userId);
        return ResponseEntity.ok(requests);
    }

    @GetMapping("/available")
    public ResponseEntity<List<Request>> getAvailableRequests(@RequestHeader("Authorization") String token) {
        String jwt = token.replace("Bearer ", "");
        Long userId = jwtUtil.getUserIdFromToken(jwt);
        List<Request> requests = requestService.getAvailableRequests(userId);
        return ResponseEntity.ok(requests);
    }

    @PostMapping("/{requestId}/confirm")
    public ResponseEntity<?> confirmRequest(
            @RequestHeader("Authorization") String token,
            @PathVariable Long requestId) {
        try {
            String jwt = token.replace("Bearer ", "");
            Long userId = jwtUtil.getUserIdFromToken(jwt);
            Request request = requestService.confirmRequest(requestId, userId);
            return ResponseEntity.ok(Map.of("message", "Request confirmed", "request", request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{requestId}/complete")
    public ResponseEntity<?> completeRequest(
            @RequestHeader("Authorization") String token,
            @PathVariable Long requestId) {
        try {
            String jwt = token.replace("Bearer ", "");
            Long userId = jwtUtil.getUserIdFromToken(jwt);
            Request request = requestService.completeRequest(requestId, userId);
            return ResponseEntity.ok(Map.of("message", "Request completed", "request", request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}

