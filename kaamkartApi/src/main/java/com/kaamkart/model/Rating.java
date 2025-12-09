package com.kaamkart.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "ratings", indexes = {
    @Index(name = "idx_ratings_request_id", columnList = "request_id"),
    @Index(name = "idx_ratings_rater_id", columnList = "rater_id"),
    @Index(name = "idx_ratings_rated_id", columnList = "rated_id"),
    @Index(name = "idx_ratings_request_rater", columnList = "request_id,rater_id"),
    @Index(name = "idx_ratings_rated", columnList = "rated_id,created_at"),
    @Index(name = "idx_ratings_created_at", columnList = "created_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Rating {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "request_id", nullable = false)
    private Request request;

    @ManyToOne
    @JoinColumn(name = "rater_id", nullable = false)
    private User rater; // The person giving the rating

    @ManyToOne
    @JoinColumn(name = "rated_id", nullable = false)
    private User rated; // The person being rated

    @Column(nullable = false)
    private Integer rating; // 1-5 stars

    @Column(length = 500)
    private String comment;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

