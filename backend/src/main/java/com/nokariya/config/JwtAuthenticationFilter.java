package com.nokariya.config;

import com.nokariya.repository.UserRepository;
import com.nokariya.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, UserRepository userRepository) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String requestPath = request.getRequestURI();

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                Long userId = jwtUtil.getUserIdFromToken(token);
                String role = jwtUtil.getRoleFromToken(token);

                if (userId != null && role != null) {
                    // Verify user exists (optional, but safer)
                    if (userRepository.findById(userId).isPresent()) {
                        List<SimpleGrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role));
                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(userId, null, authorities);
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                        System.out.println("JWT authentication successful for user: " + userId + " on path: " + requestPath);
                    } else {
                        System.err.println("JWT validation failed: User " + userId + " not found in database");
                    }
                } else {
                    System.err.println("JWT validation failed: userId or role is null");
                }
            } catch (Exception e) {
                // Invalid token - log and continue without setting authentication
                // Spring Security will handle the 403 response
                System.err.println("JWT validation failed for path " + requestPath + ": " + e.getMessage());
                e.printStackTrace();
            }
        } else {
            System.err.println("No Authorization header found for path: " + requestPath);
        }

        filterChain.doFilter(request, response);
    }
}

