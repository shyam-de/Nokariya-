package com.nokariya.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "deployed_workers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeployedWorker {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "request_id", nullable = false)
    @JsonIgnore
    private Request request;

    @ManyToOne
    @JoinColumn(name = "worker_id", nullable = false)
    @JsonIgnoreProperties({"password", "location"})
    private User worker;

    @Transient
    private Double workerRating = 0.0;

    @Column(name = "deployed_at")
    private LocalDateTime deployedAt;

    @PrePersist
    protected void onCreate() {
        deployedAt = LocalDateTime.now();
    }
}

