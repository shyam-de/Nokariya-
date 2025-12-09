package com.kaamkart.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "confirmed_workers", indexes = {
    @Index(name = "idx_confirmed_request_id", columnList = "request_id"),
    @Index(name = "idx_confirmed_worker_id", columnList = "worker_id"),
    @Index(name = "idx_confirmed_worker_request", columnList = "worker_id,request_id"),
    @Index(name = "idx_confirmed_confirmed_at", columnList = "confirmed_at"),
    @Index(name = "idx_confirmed_worker_date", columnList = "worker_id,confirmed_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConfirmedWorker {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "request_id", nullable = false)
    @JsonIgnore
    private Request request;

    @ManyToOne
    @JoinColumn(name = "worker_id", nullable = false)
    private User worker;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @PrePersist
    protected void onCreate() {
        confirmedAt = LocalDateTime.now();
    }
}

