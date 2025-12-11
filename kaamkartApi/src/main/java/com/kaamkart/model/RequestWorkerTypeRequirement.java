package com.kaamkart.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "request_worker_type_requirements", indexes = {
    @Index(name = "idx_rwt_request_id", columnList = "request_id"),
    @Index(name = "idx_rwt_worker_type", columnList = "worker_type"),
    @Index(name = "idx_rwt_request_worker_type", columnList = "request_id,worker_type")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RequestWorkerTypeRequirement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "request_id", nullable = false)
    @JsonIgnore
    private Request request;

    @Column(name = "worker_type", nullable = false, length = 100)
    private String workerType;

    @Column(name = "number_of_workers", nullable = false)
    private Integer numberOfWorkers;
}

