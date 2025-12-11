package com.kaamkart.dto;

import com.kaamkart.model.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class RegisterRequest {
    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Valid email is required")
    private String email;

    @NotBlank(message = "Phone is required")
    private String phone; // Primary contact

    private String secondaryPhone; // Secondary contact (optional)

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    private User.UserRole role;
    private LocationDto location;
    private List<String> workerTypes;
}

