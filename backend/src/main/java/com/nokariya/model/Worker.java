package com.nokariya.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "workers")
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
    @CollectionTable(name = "worker_labor_types", joinColumns = @JoinColumn(name = "worker_id"))
    @Column(name = "labor_type")
    @Enumerated(EnumType.STRING)
    private List<LaborType> laborTypes = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "worker_skills", joinColumns = @JoinColumn(name = "worker_id"))
    @Column(name = "skill")
    private List<String> skills = new ArrayList<>();

    private Integer experience = 0;

    private Double rating = 0.0;

    @Column(name = "total_jobs")
    private Integer totalJobs = 0;

    private Boolean available = true;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "latitude", column = @Column(name = "current_latitude")),
        @AttributeOverride(name = "longitude", column = @Column(name = "current_longitude")),
        @AttributeOverride(name = "address", column = @Column(name = "current_address"))
    })
    private Location currentLocation;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum LaborType {
        ELECTRICIAN, SKILLED, UNSKILLED
    }
}

