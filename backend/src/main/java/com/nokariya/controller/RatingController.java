package com.nokariya.controller;

import com.nokariya.dto.CreateRatingDto;
import com.nokariya.model.Rating;
import com.nokariya.service.RatingService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ratings")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class RatingController {
    @Autowired
    private RatingService ratingService;

    private Long getUserIdFromAuthentication(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long) {
            return (Long) authentication.getPrincipal();
        }
        throw new RuntimeException("User not authenticated");
    }

    @PostMapping
    public ResponseEntity<?> createRating(
            Authentication authentication,
            @Valid @RequestBody CreateRatingDto dto) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            Rating rating = ratingService.createRating(userId, dto);
            return ResponseEntity.ok(Map.of(
                    "message", "Rating submitted successfully",
                    "rating", rating
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getRatingsForUser(@PathVariable Long userId) {
        try {
            List<Rating> ratings = ratingService.getRatingsForUser(userId);
            return ResponseEntity.ok(ratings);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/user/{userId}/stats")
    public ResponseEntity<?> getUserRatingStats(@PathVariable Long userId) {
        try {
            Map<String, Object> stats = ratingService.getUserRatingStats(userId);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/check/{requestId}")
    public ResponseEntity<?> checkIfRated(
            Authentication authentication,
            @PathVariable Long requestId) {
        try {
            Long userId = getUserIdFromAuthentication(authentication);
            boolean hasRated = ratingService.hasRatedForRequest(userId, requestId);
            return ResponseEntity.ok(Map.of("hasRated", hasRated));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}

