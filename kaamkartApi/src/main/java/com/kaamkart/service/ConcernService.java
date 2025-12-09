package com.kaamkart.service;

import com.kaamkart.dto.CreateConcernDto;
import com.kaamkart.model.Concern;
import com.kaamkart.model.ConcernMessage;
import com.kaamkart.model.Request;
import com.kaamkart.model.User;
import com.kaamkart.repository.ConcernMessageRepository;
import com.kaamkart.repository.ConcernRepository;
import com.kaamkart.repository.RequestRepository;
import com.kaamkart.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ConcernService {
    @Autowired
    private ConcernRepository concernRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RequestRepository requestRepository;

    @Autowired
    private ConcernMessageRepository concernMessageRepository;

    @Transactional
    public Concern createConcern(Long raisedById, CreateConcernDto dto) {
        User raisedBy = userRepository.findById(raisedById)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Concern concern = new Concern();
        concern.setRaisedBy(raisedBy);
        concern.setDescription(dto.getDescription());
        concern.setType(dto.getType());
        concern.setStatus(Concern.ConcernStatus.PENDING);

        // Set related request if provided
        if (dto.getRequestId() != null) {
            Request request = requestRepository.findById(dto.getRequestId())
                    .orElseThrow(() -> new RuntimeException("Request not found"));
            concern.setRequest(request);
        }

        // Set related user if provided
        if (dto.getRelatedToUserId() != null) {
            User relatedTo = userRepository.findById(dto.getRelatedToUserId())
                    .orElseThrow(() -> new RuntimeException("Related user not found"));
            concern.setRelatedTo(relatedTo);
        }

        return concernRepository.save(concern);
    }

    public List<Concern> getConcernsByUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return concernRepository.findByRaisedByOrderByCreatedAtDesc(user);
    }

    public List<Concern> getAllConcerns() {
        return concernRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<Concern> getPendingConcerns() {
        return concernRepository.findByStatusOrderByCreatedAtDesc(Concern.ConcernStatus.PENDING);
    }

    @Transactional
    public Concern updateConcernStatus(Long concernId, Concern.ConcernStatus status, String adminResponse) {
        Concern concern = concernRepository.findById(concernId)
                .orElseThrow(() -> new RuntimeException("Concern not found"));

        concern.setStatus(status);
        if (adminResponse != null && !adminResponse.trim().isEmpty()) {
            concern.setAdminResponse(adminResponse);
        }

        if (status == Concern.ConcernStatus.RESOLVED) {
            concern.setResolvedAt(LocalDateTime.now());
        }

        return concernRepository.save(concern);
    }

    @Transactional
    public Concern updateConcernStatusByUser(Long concernId, Long userId, Concern.ConcernStatus status, String message) {
        Concern concern = concernRepository.findById(concernId)
                .orElseThrow(() -> new RuntimeException("Concern not found"));

        // Verify that the user owns this concern
        if (!concern.getRaisedBy().getId().equals(userId)) {
            throw new RuntimeException("You can only update your own concerns");
        }

        // Users can only set status to PENDING or RESOLVED
        if (status != Concern.ConcernStatus.PENDING && status != Concern.ConcernStatus.RESOLVED) {
            throw new RuntimeException("You can only update status to PENDING or RESOLVED");
        }

        concern.setStatus(status);

        if (status == Concern.ConcernStatus.RESOLVED) {
            concern.setResolvedAt(LocalDateTime.now());
        } else if (status == Concern.ConcernStatus.PENDING && concern.getResolvedAt() != null) {
            // If changing from RESOLVED to PENDING, clear resolvedAt
            concern.setResolvedAt(null);
        }

        Concern savedConcern = concernRepository.save(concern);
        
        // Add message to conversation if provided
        if (message != null && !message.trim().isEmpty()) {
            addMessageToConcern(concernId, userId, message);
        }

        return savedConcern;
    }

    @Transactional
    public ConcernMessage addMessageToConcern(Long concernId, Long userId, String message) {
        Concern concern = concernRepository.findById(concernId)
                .orElseThrow(() -> new RuntimeException("Concern not found"));

        User sentBy = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (message == null || message.trim().isEmpty()) {
            throw new RuntimeException("Message cannot be empty");
        }

        ConcernMessage concernMessage = new ConcernMessage();
        concernMessage.setConcern(concern);
        concernMessage.setSentBy(sentBy);
        concernMessage.setMessage(message);

        return concernMessageRepository.save(concernMessage);
    }

    public List<ConcernMessage> getConcernMessages(Long concernId) {
        Concern concern = concernRepository.findById(concernId)
                .orElseThrow(() -> new RuntimeException("Concern not found"));
        return concernMessageRepository.findByConcernOrderByCreatedAtAsc(concern);
    }
}

