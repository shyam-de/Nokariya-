package com.kaamkart.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "success_stories", indexes = {
    @Index(name = "idx_stories_is_active", columnList = "is_active"),
    @Index(name = "idx_stories_display_order", columnList = "display_order"),
    @Index(name = "idx_stories_active_order", columnList = "is_active,display_order,created_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuccessStory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "customer_name", length = 100)
    private String customerName;

    @Column(name = "worker_name", length = 100)
    private String workerName;

    @Column(name = "labor_type", length = 50)
    private String laborType;

    @Column(name = "rating")
    private Integer rating; // 1-5 stars

    @Column(name = "image_url")
    private String imageUrl; // Optional image URL

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "display_order")
    private Integer displayOrder = 0; // For ordering on homepage

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

