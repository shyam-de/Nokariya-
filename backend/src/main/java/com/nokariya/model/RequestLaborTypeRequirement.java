package com.nokariya.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "request_labor_type_requirements")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RequestLaborTypeRequirement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "request_id", nullable = false)
    @JsonIgnore
    private Request request;

    @Enumerated(EnumType.STRING)
    @Column(name = "labor_type", nullable = false)
    private Worker.LaborType laborType;

    @Column(name = "number_of_workers", nullable = false)
    private Integer numberOfWorkers;
}

