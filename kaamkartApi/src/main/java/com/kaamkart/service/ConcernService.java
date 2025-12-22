package com.kaamkart.service;

import com.kaamkart.dto.CreateConcernDto;
import com.kaamkart.model.Concern;
import com.kaamkart.model.ConcernMessage;
import com.kaamkart.model.Request;
import com.kaamkart.model.SystemUser;
import com.kaamkart.model.User;
import com.kaamkart.repository.ConcernMessageRepository;
import com.kaamkart.repository.ConcernRepository;
import com.kaamkart.repository.RequestRepository;
import com.kaamkart.repository.SystemUserRepository;
import com.kaamkart.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ConcernService {
    @Autowired
    private ConcernRepository concernRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SystemUserRepository systemUserRepository;

    @Autowired
    private RequestRepository requestRepository;

    @Autowired
    private ConcernMessageRepository concernMessageRepository;

    @Autowired
    private AdminService adminService;

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

    public List<Concern> getAllConcerns(Long adminId, String search, String sortBy, String sortOrder, Boolean locationFilter) {
        List<Concern> concerns = concernRepository.findAllByOrderByCreatedAtDesc();
        
        // Apply location filter
        boolean shouldFilterByLocation = false;
        if (adminId != null && !adminService.isSuperAdmin(adminId)) {
            // Normal admin: always filter by location
            shouldFilterByLocation = true;
        } else if (adminId != null && adminService.isSuperAdmin(adminId) && locationFilter != null && locationFilter) {
            // Super admin: filter only if locationFilter is explicitly true
            shouldFilterByLocation = true;
        }
        
        if (shouldFilterByLocation) {
            concerns = adminService.filterConcernsByAdminRadius(concerns, adminId);
        }
        
        // Apply search filter
        if (search != null && !search.trim().isEmpty()) {
            String searchLower = search.toLowerCase();
            concerns = concerns.stream()
                    .filter(concern -> 
                            (concern.getUserMessage() != null && concern.getUserMessage().toLowerCase().contains(searchLower)) ||
                            (concern.getDescription() != null && concern.getDescription().toLowerCase().contains(searchLower)) ||
                            (concern.getRaisedBy() != null && concern.getRaisedBy().getName() != null && 
                             concern.getRaisedBy().getName().toLowerCase().contains(searchLower)) ||
                            (concern.getRaisedBy() != null && concern.getRaisedBy().getEmail() != null && 
                             concern.getRaisedBy().getEmail().toLowerCase().contains(searchLower)) ||
                            (concern.getStatus() != null && concern.getStatus().name().toLowerCase().contains(searchLower)))
                    .collect(java.util.stream.Collectors.toList());
        }
        
        // Apply sorting
        if (sortBy != null && sortOrder != null) {
            Comparator<Concern> comparator = null;
            switch (sortBy.toLowerCase()) {
                case "date":
                    comparator = Comparator.comparing(Concern::getCreatedAt);
                    break;
                case "status":
                    comparator = Comparator.comparing(c -> c.getStatus().name());
                    break;
                default:
                    comparator = Comparator.comparing(Concern::getCreatedAt);
            }
            
            if (sortOrder.equalsIgnoreCase("desc")) {
                comparator = comparator.reversed();
            }
            concerns = concerns.stream().sorted(comparator).collect(Collectors.toList());
        }
        
        return concerns;
    }

    public List<Concern> getPendingConcerns(Long adminId) {
        List<Concern> concerns = concernRepository.findByStatusOrderByCreatedAtDesc(Concern.ConcernStatus.PENDING);
        // Filter by admin radius if adminId is provided and not a super admin
        if (adminId != null && !adminService.isSuperAdmin(adminId)) {
            concerns = adminService.filterConcernsByAdminRadius(concerns, adminId);
        }
        return concerns;
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

        if (message == null || message.trim().isEmpty()) {
            throw new RuntimeException("Message cannot be empty");
        }

        ConcernMessage concernMessage = new ConcernMessage();
        concernMessage.setConcern(concern);
        concernMessage.setMessage(message);

        // Handle system users (negative IDs) - they are stored in SystemUser table, not User table
        if (userId < 0) {
            // System user - get from SystemUser table
            Long systemUserId = Math.abs(userId);
            SystemUser systemUser = systemUserRepository.findById(systemUserId)
                    .orElseThrow(() -> new RuntimeException("System user not found"));
            
            concernMessage.setSentBy(null); // No User reference for system users
            concernMessage.setSentBySystemUserId(userId); // Store negative ID to identify as system user
            concernMessage.setSentByName(systemUser.getName());
        } else {
            // Regular user - get from User table
            User sentBy = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            concernMessage.setSentBy(sentBy);
            concernMessage.setSentBySystemUserId(null);
            concernMessage.setSentByName(sentBy.getName());
        }

        return concernMessageRepository.save(concernMessage);
    }

    public List<ConcernMessage> getConcernMessages(Long concernId) {
        Concern concern = concernRepository.findById(concernId)
                .orElseThrow(() -> new RuntimeException("Concern not found"));
        return concernMessageRepository.findByConcernOrderByCreatedAtAsc(concern);
    }
}

