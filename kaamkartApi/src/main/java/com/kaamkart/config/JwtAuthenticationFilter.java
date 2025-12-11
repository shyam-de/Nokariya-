package com.kaamkart.config;

import com.kaamkart.repository.SystemUserRepository;
import com.kaamkart.repository.UserRepository;
import com.kaamkart.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final SystemUserRepository systemUserRepository;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, UserRepository userRepository, SystemUserRepository systemUserRepository) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.systemUserRepository = systemUserRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String requestPath = request.getRequestURI();
        
        // Skip JWT filter for auth endpoints (login, register, health)
        if (requestPath.startsWith("/api/auth/")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                Long userId = jwtUtil.getUserIdFromToken(token);
                String role = jwtUtil.getRoleFromToken(token);

                if (userId != null && role != null) {
                    // Check if it's a system user (negative ID) or regular user
                    boolean userExists = false;
                    if (userId < 0) {
                        // System user - use positive ID to lookup
                        Long systemUserId = Math.abs(userId);
                        userExists = systemUserRepository.findById(systemUserId).isPresent();
                    } else {
                        // Regular user
                        userExists = userRepository.findById(userId).isPresent();
                    }
                    
                    if (userExists) {
                        // Normalize role (remove SYSTEM_ prefix if present)
                        String normalizedRole = role.startsWith("SYSTEM_") ? role.substring(7) : role;
                        List<SimpleGrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + normalizedRole));
                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(userId, null, authorities);
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                        // Set userId in request attribute for logging interceptor
                        request.setAttribute("userId", userId);
                        logger.debug("JWT authentication successful for user: {} on path: {}", userId, requestPath);
                    } else {
                        logger.warn("JWT validation failed: User {} not found in database", userId);
                    }
                } else {
                    logger.warn("JWT validation failed: userId or role is null");
                }
            } catch (Exception e) {
                // Invalid token - log and continue without setting authentication
                // Spring Security will handle the 403 response
                logger.debug("JWT validation failed for path {}: {}", requestPath, e.getMessage());
            }
        } else {
            logger.debug("No Authorization header found for path: {}", requestPath);
        }

        filterChain.doFilter(request, response);
    }
}

