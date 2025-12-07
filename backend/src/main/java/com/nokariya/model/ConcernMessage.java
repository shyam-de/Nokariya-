package com.nokariya.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "concern_messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConcernMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "concern_id", nullable = false)
    private Concern concern;

    @ManyToOne
    @JoinColumn(name = "sent_by_id", nullable = false)
    private User sentBy; // The user who sent the message (can be customer, worker, or admin)

    @Column(nullable = false, length = 1000)
    private String message;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

