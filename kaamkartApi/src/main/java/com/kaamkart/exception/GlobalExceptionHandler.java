package com.kaamkart.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, Object> errors = new HashMap<>();
        Map<String, String> fieldErrors = new HashMap<>();
        
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            fieldErrors.put(fieldName, errorMessage);
        });
        
        errors.put("message", "Validation failed");
        errors.put("errors", fieldErrors);
        errors.put("error", "ValidationException");
        
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgumentException(IllegalArgumentException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("message", ex.getMessage());
        error.put("error", "IllegalArgumentException");
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeException(RuntimeException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("message", ex.getMessage());
        error.put("error", "RuntimeException");
        
        // Check if this is an authentication-related error (from login/register)
        String message = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        if (message.contains("invalid credentials") || 
            message.contains("user not found") || 
            message.contains("user already exists") ||
            message.contains("blocked")) {
            // Return 401 for authentication errors
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
        }
        
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        logger.error("Unexpected error occurred: {}", ex.getMessage(), ex);
        Map<String, Object> error = new HashMap<>();
        // Sanitize error message - don't expose internal details in production
        String errorMessage = ex.getMessage() != null ? ex.getMessage() : "An unexpected error occurred";
        // Remove stack trace details if present
        if (errorMessage.contains("\n") || errorMessage.contains("at ")) {
            errorMessage = "An unexpected error occurred. Please try again later.";
        }
        error.put("message", errorMessage);
        error.put("error", ex.getClass().getSimpleName());
        // Only include detailed error info in development
        if (logger.isDebugEnabled()) {
            error.put("details", ex.getMessage());
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}

