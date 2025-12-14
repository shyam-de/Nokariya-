package com.kaamkart.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "requests", indexes = {
    @Index(name = "idx_requests_customer_id", columnList = "customer_id"),
    @Index(name = "idx_requests_status", columnList = "status"),
    @Index(name = "idx_requests_start_date", columnList = "start_date"),
    @Index(name = "idx_requests_end_date", columnList = "end_date"),
    @Index(name = "idx_requests_date_range", columnList = "start_date,end_date"),
    @Index(name = "idx_requests_status_dates", columnList = "status,start_date,end_date"),
    @Index(name = "idx_requests_created_at", columnList = "created_at"),
    @Index(name = "idx_requests_completed_at", columnList = "completed_at"),
    @Index(name = "idx_requests_location", columnList = "location_latitude,location_longitude")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Request {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ElementCollection
    @CollectionTable(name = "request_worker_types", joinColumns = @JoinColumn(name = "request_id"))
    @Column(name = "worker_type")
    private List<String> workerTypes = new ArrayList<>();

    @OneToMany(mappedBy = "request", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RequestWorkerTypeRequirement> workerTypeRequirements = new ArrayList<>();

    @Column(name = "work_type", nullable = false)
    private String workType;

    @Column(name = "number_of_workers", nullable = false)
    private Integer numberOfWorkers; // Total number of workers (sum of all requirements)

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "latitude", column = @Column(name = "location_latitude")),
        @AttributeOverride(name = "longitude", column = @Column(name = "location_longitude")),
        @AttributeOverride(name = "address", column = @Column(name = "location_address")),
        @AttributeOverride(name = "landmark", column = @Column(name = "location_landmark"))
    })
    private Location location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RequestStatus status = RequestStatus.PENDING;

    @OneToMany(mappedBy = "request", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ConfirmedWorker> confirmedWorkers = new ArrayList<>();

    @OneToMany(mappedBy = "request", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DeployedWorker> deployedWorkers = new ArrayList<>();

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Transient
    private Double customerRating = 0.0;

    @Transient
    private Boolean workerConfirmed = false;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum RequestStatus {
        PENDING, PENDING_ADMIN_APPROVAL, ADMIN_APPROVED, NOTIFIED, CONFIRMED, DEPLOYED, COMPLETED, CANCELLED, REJECTED
    }
}

