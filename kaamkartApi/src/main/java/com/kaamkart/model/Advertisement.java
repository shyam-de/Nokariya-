package com.kaamkart.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "advertisements", indexes = {
    @Index(name = "idx_ads_is_active", columnList = "is_active"),
    @Index(name = "idx_ads_display_order", columnList = "display_order"),
    @Index(name = "idx_ads_active_order", columnList = "is_active,display_order,created_at"),
    @Index(name = "idx_ads_start_date", columnList = "start_date"),
    @Index(name = "idx_ads_end_date", columnList = "end_date"),
    @Index(name = "idx_ads_date_range", columnList = "start_date,end_date")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Advertisement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text; // Advertisement text/content

    @Column(name = "image_url")
    private String imageUrl; // Optional image URL

    @Column(name = "link_url")
    private String linkUrl; // Optional link URL (where to redirect on click)

    @Column(name = "link_text", length = 100)
    private String linkText; // Text for the link button (e.g., "Learn More", "Shop Now")

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "display_order")
    private Integer displayOrder = 0; // For ordering if multiple ads

    @Column(name = "start_date")
    private LocalDateTime startDate; // When ad should start showing

    @Column(name = "end_date")
    private LocalDateTime endDate; // When ad should stop showing (optional)

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (startDate == null) {
            startDate = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

