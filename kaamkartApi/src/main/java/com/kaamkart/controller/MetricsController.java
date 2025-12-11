package com.kaamkart.controller;

import com.kaamkart.model.ApiLog;
import com.kaamkart.repository.ApiLogRepository;
import com.kaamkart.service.MetricsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/metrics")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class MetricsController {

    private static final Logger logger = LoggerFactory.getLogger(MetricsController.class);

    @Autowired
    private MetricsService metricsService;

    @Autowired
    private ApiLogRepository apiLogRepository;

    /**
     * Get metrics summary for the last N hours (default 24)
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getMetricsSummary(
            @RequestParam(defaultValue = "24") int hours) {
        try {
            logger.info("📊 Metrics summary requested for last {} hours", hours);
            Map<String, Object> metrics = metricsService.getMetricsSummary(hours);
            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            logger.error("Error fetching metrics summary", e);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get recent errors
     */
    @GetMapping("/errors")
    public ResponseEntity<List<ApiLog>> getRecentErrors(
            @RequestParam(defaultValue = "50") int limit) {
        try {
            List<ApiLog> errors = metricsService.getRecentErrors(limit);
            return ResponseEntity.ok(errors);
        } catch (Exception e) {
            logger.error("Error fetching recent errors", e);
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Get API logs with pagination
     */
    @GetMapping("/logs")
    public ResponseEntity<Page<ApiLog>> getApiLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String endpoint,
            @RequestParam(required = false) Integer statusCode,
            @RequestParam(required = false) Long userId) {
        try {
            Pageable pageable = PageRequest.of(page, size);
            Page<ApiLog> logs;
            
            if (endpoint != null) {
                logs = apiLogRepository.findByEndpointContaining(endpoint, pageable);
            } else if (statusCode != null) {
                logs = apiLogRepository.findByStatusCode(statusCode, pageable);
            } else if (userId != null) {
                logs = apiLogRepository.findByUserId(userId, pageable);
            } else {
                logs = apiLogRepository.findAll(pageable);
            }
            
            return ResponseEntity.ok(logs);
        } catch (Exception e) {
            logger.error("Error fetching API logs", e);
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Get endpoint statistics
     */
    @GetMapping("/endpoints")
    public ResponseEntity<List<Object[]>> getEndpointStats(
            @RequestParam(defaultValue = "24") int hours) {
        try {
            List<Object[]> stats = metricsService.getEndpointStats(hours);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Error fetching endpoint stats", e);
            return ResponseEntity.status(500).build();
        }
    }
}

