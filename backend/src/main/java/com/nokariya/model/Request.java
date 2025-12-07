package com.nokariya.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "requests")
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

    @Enumerated(EnumType.STRING)
    @Column(name = "labor_type", nullable = false)
    private LaborType laborType;

    @Column(name = "work_type", nullable = false)
    private String workType;

    @Column(name = "number_of_workers", nullable = false)
    private Integer numberOfWorkers;

    @Embedded
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

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum LaborType {
        ELECTRICIAN, SKILLED, UNSKILLED
    }

    public enum RequestStatus {
        PENDING, PENDING_ADMIN_APPROVAL, ADMIN_APPROVED, NOTIFIED, CONFIRMED, DEPLOYED, COMPLETED, CANCELLED, REJECTED
    }
}

