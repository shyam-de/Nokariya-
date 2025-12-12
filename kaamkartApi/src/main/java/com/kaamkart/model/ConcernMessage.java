package com.kaamkart.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "concern_messages", indexes = {
    @Index(name = "idx_concern_messages_concern_id", columnList = "concern_id"),
    @Index(name = "idx_concern_messages_created_at", columnList = "created_at"),
    @Index(name = "idx_concern_messages_concern_created", columnList = "concern_id,created_at")
})
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
    @JoinColumn(name = "sent_by_id", nullable = true)
    private User sentBy; // The user who sent the message (can be customer, worker, or admin)
    
    @Column(name = "sent_by_system_user_id", nullable = true)
    private Long sentBySystemUserId; // System user ID if message is from a system admin (negative ID)
    
    @Column(name = "sent_by_name", nullable = true, length = 255)
    private String sentByName; // Name of the sender (for system users or when user is deleted)

    @Column(nullable = false, length = 1000)
    private String message;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

