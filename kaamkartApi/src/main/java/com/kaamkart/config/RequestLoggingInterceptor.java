package com.kaamkart.config;

import com.kaamkart.model.ApiLog;
import com.kaamkart.repository.ApiLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;

@Component
public class RequestLoggingInterceptor implements HandlerInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(RequestLoggingInterceptor.class);

    @Autowired
    private ApiLogRepository apiLogRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        long startTime = System.currentTimeMillis();
        request.setAttribute("startTime", startTime);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, 
                                Object handler, Exception ex) {
        try {
            long startTime = (Long) request.getAttribute("startTime");
            long endTime = System.currentTimeMillis();
            long responseTime = endTime - startTime;

            String endpoint = request.getRequestURI();
            String method = request.getMethod();
            String ipAddress = getClientIpAddress(request);
            
            // Get user ID from request attribute if set by JWT filter
            Long userId = (Long) request.getAttribute("userId");

            int statusCode = response.getStatus();
            // Only log user agent for errors (security monitoring)
            String userAgent = statusCode >= 400 ? request.getHeader("User-Agent") : null;
            String errorMessage = null;
            String errorStackTrace = null;
            String requestBody = null;
            String responseBody = null;

            // Only log request/response bodies for errors or critical endpoints
            boolean shouldLogBody = statusCode >= 400 || 
                                   endpoint.startsWith("/api/auth/login") ||
                                   endpoint.startsWith("/api/requests") && method.equals("POST");

            if (shouldLogBody) {
                // Get request body only for errors or critical operations
                try {
                    if (request instanceof ContentCachingRequestWrapper) {
                        ContentCachingRequestWrapper wrappedRequest = (ContentCachingRequestWrapper) request;
                        byte[] content = wrappedRequest.getContentAsByteArray();
                        if (content.length > 0) {
                            requestBody = new String(content, StandardCharsets.UTF_8);
                            // Limit request body size for logging
                            if (requestBody.length() > 2000) {
                                requestBody = requestBody.substring(0, 2000) + "... [truncated]";
                            }
                        }
                    }
                } catch (Exception e) {
                    // Silently ignore - not critical
                }
            }

            // Always try to get response body for errors, or for critical endpoints
            if (shouldLogBody) {
                try {
                    if (response instanceof ContentCachingResponseWrapper) {
                        ContentCachingResponseWrapper wrappedResponse = (ContentCachingResponseWrapper) response;
                        // Force cache the response body before reading
                        byte[] content = wrappedResponse.getContentAsByteArray();
                        if (content.length > 0) {
                            responseBody = new String(content, StandardCharsets.UTF_8);
                            // Limit response body size for logging
                            if (responseBody.length() > 2000) {
                                responseBody = responseBody.substring(0, 2000) + "... [truncated]";
                            }
                        } else {
                            logger.debug("Response body is empty for endpoint: {}", endpoint);
                        }
                    } else {
                        logger.debug("Response is not wrapped in ContentCachingResponseWrapper for endpoint: {}", endpoint);
                    }
                } catch (Exception e) {
                    logger.debug("Could not read response body for endpoint {}: {}", endpoint, e.getMessage());
                }
            }

            if (ex != null) {
                errorMessage = ex.getMessage();
                // Only log stack trace for errors
                if (statusCode >= 400) {
                    errorStackTrace = getStackTrace(ex);
                }
            }

            // Log to console (only errors in detail, success briefly)
            if (statusCode >= 400) {
                logger.warn("API Error: {} {} | Status: {} | Time: {}ms | User: {} | IP: {} | Error: {}", 
                        method, endpoint, statusCode, responseTime, userId != null ? userId : "anonymous", 
                        ipAddress, errorMessage != null ? errorMessage : "Unknown error");
            } else {
                // Only log successful requests for critical endpoints
                if (endpoint.startsWith("/api/auth/login") || 
                    endpoint.startsWith("/api/requests") && method.equals("POST") ||
                    endpoint.startsWith("/api/requests") && endpoint.contains("/confirm")) {
                    logger.debug("API Request: {} {} | Status: {} | Time: {}ms | User: {}", 
                            method, endpoint, statusCode, responseTime, userId != null ? userId : "anonymous");
                }
            }

            // Save to database asynchronously to avoid blocking
            ApiLog apiLog = new ApiLog();
            apiLog.setEndpoint(endpoint);
            apiLog.setMethod(method);
            apiLog.setUserId(userId);
            apiLog.setIpAddress(ipAddress);
            apiLog.setUserAgent(userAgent);
            apiLog.setRequestBody(requestBody);
            apiLog.setResponseBody(responseBody);
            apiLog.setStatusCode(statusCode);
            apiLog.setResponseTimeMs(responseTime);
            apiLog.setErrorMessage(errorMessage);
            apiLog.setErrorStackTrace(errorStackTrace);
            apiLog.setCreatedAt(LocalDateTime.now());

            // Save asynchronously
            CompletableFuture.runAsync(() -> {
                try {
                    apiLogRepository.save(apiLog);
                } catch (Exception e) {
                    logger.error("Failed to save API log to database", e);
                }
            });

        } catch (Exception e) {
            logger.error("Error in request logging interceptor", e);
        }
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }

    private String getStackTrace(Exception ex) {
        java.io.StringWriter sw = new java.io.StringWriter();
        java.io.PrintWriter pw = new java.io.PrintWriter(sw);
        ex.printStackTrace(pw);
        String stackTrace = sw.toString();
        // Limit stack trace size
        if (stackTrace.length() > 10000) {
            stackTrace = stackTrace.substring(0, 10000) + "... [truncated]";
        }
        return stackTrace;
    }
}

