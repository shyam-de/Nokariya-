package com.kaamkart.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;

@Component
@Order(1) // Execute before security filter to wrap requests/responses early
public class ContentCachingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, 
                                    FilterChain filterChain) throws ServletException, IOException {
        // Only wrap for API endpoints
        if (request.getRequestURI().startsWith("/api/")) {
            ContentCachingRequestWrapper wrappedRequest = new ContentCachingRequestWrapper(request);
            ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
            
            try {
                filterChain.doFilter(wrappedRequest, wrappedResponse);
            } finally {
                // Ensure response body is cached before copying
                // This allows the interceptor to read it
                wrappedResponse.getContentAsByteArray();
                wrappedResponse.copyBodyToResponse();
            }
        } else {
            filterChain.doFilter(request, response);
        }
    }
}

