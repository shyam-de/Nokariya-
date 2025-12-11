package com.kaamkart.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "workers", indexes = {
    @Index(name = "idx_workers_user_id", columnList = "user_id"),
    @Index(name = "idx_workers_available", columnList = "available"),
    @Index(name = "idx_workers_verified", columnList = "verified"),
    @Index(name = "idx_workers_available_verified", columnList = "available,verified"),
    @Index(name = "idx_workers_rating", columnList = "rating"),
    @Index(name = "idx_workers_created_at", columnList = "created_at"),
    @Index(name = "idx_workers_location", columnList = "current_latitude,current_longitude")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Worker {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @ElementCollection
    @CollectionTable(name = "workers_worker_types", joinColumns = @JoinColumn(name = "worker_id"))
    @Column(name = "worker_type")
    private List<String> workerTypes = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "worker_skills", joinColumns = @JoinColumn(name = "worker_id"))
    @Column(name = "skill")
    private List<String> skills = new ArrayList<>();

    private Integer experience = 0;

    private Double rating = 0.0;

    @Column(name = "total_jobs")
    private Integer totalJobs = 0;

    private Boolean available = true;

    @Column(name = "verified", nullable = false)
    private Boolean verified = false;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "latitude", column = @Column(name = "current_latitude")),
        @AttributeOverride(name = "longitude", column = @Column(name = "current_longitude")),
        @AttributeOverride(name = "address", column = @Column(name = "current_address")),
        @AttributeOverride(name = "landmark", column = @Column(name = "current_landmark"))
    })
    private Location currentLocation;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

