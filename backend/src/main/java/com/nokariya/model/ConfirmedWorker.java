package com.nokariya.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "confirmed_workers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConfirmedWorker {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "request_id", nullable = false)
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

