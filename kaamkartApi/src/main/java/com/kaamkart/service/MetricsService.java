package com.kaamkart.service;

import com.kaamkart.model.ApiLog;
import com.kaamkart.repository.ApiLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MetricsService {

    @Autowired
    private ApiLogRepository apiLogRepository;

    /**
     * Get error count for a specific endpoint
     */
    public Long getErrorCount(String endpoint) {
        return apiLogRepository.countErrorsByEndpoint(endpoint);
    }

    /**
     * Get average response time for an endpoint
     */
    public Double getAverageResponseTime(String endpoint) {
        Double avgTime = apiLogRepository.getAverageResponseTime(endpoint);
        return avgTime != null ? avgTime : 0.0;
    }

    /**
     * Get endpoint statistics for the last N hours
     */
    public List<Object[]> getEndpointStats(int hours) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        return apiLogRepository.getEndpointStats(since);
    }

    /**
     * Get comprehensive metrics summary
     */
    public Map<String, Object> getMetricsSummary(int hours) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        
        Map<String, Object> metrics = new HashMap<>();
        
        // Get endpoint stats
        List<Object[]> endpointStats = apiLogRepository.getEndpointStats(since);
        metrics.put("endpointStats", endpointStats);
        
        // Get error rates for critical endpoints
        Map<String, Long> errorCounts = new HashMap<>();
        errorCounts.put("/api/auth/login", getErrorCount("/api/auth/login"));
        errorCounts.put("/api/requests", getErrorCount("/api/requests"));
        errorCounts.put("/api/requests/*/confirm", getErrorCount("/api/requests"));
        metrics.put("errorCounts", errorCounts);
        
        // Get average response times for critical endpoints
        Map<String, Double> avgResponseTimes = new HashMap<>();
        avgResponseTimes.put("/api/auth/login", getAverageResponseTime("/api/auth/login"));
        avgResponseTimes.put("/api/requests", getAverageResponseTime("/api/requests"));
        metrics.put("avgResponseTimes", avgResponseTimes);
        
        // Get total requests in time period
        List<ApiLog> recentLogs = apiLogRepository.findByCreatedAtBetween(since, LocalDateTime.now());
        metrics.put("totalRequests", recentLogs.size());
        
        // Get error rate
        long errorCount = recentLogs.stream()
                .filter(log -> log.getStatusCode() >= 400)
                .count();
        double errorRate = recentLogs.isEmpty() ? 0.0 : (errorCount * 100.0 / recentLogs.size());
        metrics.put("errorRate", errorRate);
        
        return metrics;
    }

    /**
     * Get recent errors
     */
    public List<ApiLog> getRecentErrors(int limit) {
        // Get all logs and filter for errors (status code >= 400)
        List<ApiLog> allLogs = apiLogRepository.findAll(
                PageRequest.of(0, limit * 10))
                .getContent();
        
        return allLogs.stream()
                .filter(log -> log.getStatusCode() >= 400)
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .limit(limit)
                .collect(java.util.stream.Collectors.toList());
    }
}

