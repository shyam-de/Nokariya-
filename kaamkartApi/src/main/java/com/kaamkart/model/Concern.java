package com.kaamkart.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "concerns", indexes = {
    @Index(name = "idx_concerns_request_id", columnList = "request_id"),
    @Index(name = "idx_concerns_raised_by", columnList = "raised_by_id"),
    @Index(name = "idx_concerns_related_to", columnList = "related_to_id"),
    @Index(name = "idx_concerns_status", columnList = "status"),
    @Index(name = "idx_concerns_type", columnList = "type"),
    @Index(name = "idx_concerns_status_type", columnList = "status,type"),
    @Index(name = "idx_concerns_created_at", columnList = "created_at"),
    @Index(name = "idx_concerns_resolved_at", columnList = "resolved_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Concern {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "request_id", nullable = true)
    private Request request; // Optional - concern can be related to a specific request

    @ManyToOne
    @JoinColumn(name = "raised_by_id", nullable = false)
    private User raisedBy; // The user who raised the concern

    @ManyToOne
    @JoinColumn(name = "related_to_id", nullable = true)
    private User relatedTo; // The user the concern is about (optional)

    @Column(nullable = false, length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ConcernType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ConcernStatus status = ConcernStatus.PENDING;

    @Column(name = "admin_response", length = 1000)
    private String adminResponse;

    @Column(name = "user_message", length = 1000)
    private String userMessage;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum ConcernType {
        WORK_QUALITY,
        PAYMENT_ISSUE,
        BEHAVIOR,
        SAFETY,
        OTHER
    }

    public enum ConcernStatus {
        PENDING,
        IN_REVIEW,
        RESOLVED,
        DISMISSED
    }
}

