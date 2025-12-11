package com.kaamkart.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "worker_types", indexes = {
    @Index(name = "idx_worker_types_name", columnList = "name"),
    @Index(name = "idx_worker_types_active", columnList = "is_active"),
    @Index(name = "idx_worker_types_active_name", columnList = "is_active,name")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkerType {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name; // e.g., "ELECTRICIAN", "DRIVER", etc.

    @Column(name = "display_name", length = 200)
    private String displayName; // e.g., "Electrician", "Driver", etc.

    @Column(name = "icon", length = 10)
    private String icon; // e.g., "⚡", "🚗", etc.

    @Column(name = "description", length = 500)
    private String description; // e.g., "Electrical repairs, installations & maintenance"

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (displayName == null || displayName.isEmpty()) {
            // Auto-generate display name from name if not provided
            displayName = name.substring(0, 1).toUpperCase() + name.substring(1).toLowerCase().replace("_", " ");
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

