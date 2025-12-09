package com.kaamkart.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_users_email", columnList = "email"),
    @Index(name = "idx_users_role", columnList = "role"),
    @Index(name = "idx_users_blocked", columnList = "blocked"),
    @Index(name = "idx_users_role_blocked", columnList = "role,blocked"),
    @Index(name = "idx_users_created_at", columnList = "created_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String phone; // Primary contact

    @Column(name = "secondary_phone")
    private String secondaryPhone; // Secondary contact (optional)

    @Column(nullable = false)
    @JsonIgnore
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    @Embedded
    private Location location;

    @Column(name = "blocked", nullable = false)
    private Boolean blocked = false;

    @Column(name = "super_admin", nullable = false)
    private Boolean superAdmin = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum UserRole {
        CUSTOMER, WORKER, ADMIN
    }
}

