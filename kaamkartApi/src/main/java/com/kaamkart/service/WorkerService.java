package com.kaamkart.service;

import com.kaamkart.dto.LocationDto;
import com.kaamkart.dto.UpdateProfileDto;
import com.kaamkart.model.*;
import com.kaamkart.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class WorkerService {
    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConfirmedWorkerRepository confirmedWorkerRepository;

    @Autowired
    private DeployedWorkerRepository deployedWorkerRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public Worker getWorkerProfile(Long userId) {
        return workerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Worker profile not found"));
    }

    @Transactional
    public Worker updateLocation(Long userId, LocationDto locationDto) {
        Worker worker = workerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Worker profile not found"));

        Location location = new Location();
        location.setLatitude(locationDto.getLatitude());
        location.setLongitude(locationDto.getLongitude());
        location.setAddress(locationDto.getAddress());
        worker.setCurrentLocation(location);

        // Notify via WebSocket if needed
        Map<String, Object> locationUpdate = new HashMap<>();
        locationUpdate.put("workerId", userId);
        locationUpdate.put("location", locationDto);
        messagingTemplate.convertAndSend("/topic/worker-location/" + userId, locationUpdate);

        return workerRepository.save(worker);
    }

    @Transactional
    public Worker updateAvailability(Long userId, Boolean available) {
        Worker worker = workerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Worker profile not found"));

        worker.setAvailable(available);

        // Notify via WebSocket
        Map<String, Object> availabilityUpdate = new HashMap<>();
        availabilityUpdate.put("workerId", userId);
        availabilityUpdate.put("available", available);
        messagingTemplate.convertAndSend("/topic/worker-availability/" + userId, availabilityUpdate);

        return workerRepository.save(worker);
    }

    public List<Map<String, Object>> getWorkHistory(@NonNull Long userId) {
        User worker = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Worker not found"));

        List<Map<String, Object>> history = new ArrayList<>();
        Set<Long> deployedRequestIds = new HashSet<>();

        // First, get all deployed work and track their request IDs
        List<DeployedWorker> deployedWork = deployedWorkerRepository.findByWorkerOrderByDeployedAtDesc(worker);
        for (DeployedWorker dw : deployedWork) {
            deployedRequestIds.add(dw.getRequest().getId());
            Map<String, Object> entry = new HashMap<>();
            entry.put("type", "deployed");
            entry.put("requestId", dw.getRequest().getId());
            entry.put("workerTypes", dw.getRequest().getWorkerTypes() != null ? 
                dw.getRequest().getWorkerTypes() : new ArrayList<>());
            entry.put("workType", dw.getRequest().getWorkType());
            entry.put("location", dw.getRequest().getLocation());
            entry.put("status", dw.getRequest().getStatus());
            entry.put("date", dw.getDeployedAt());
            entry.put("customer", Map.of(
                    "id", dw.getRequest().getCustomer().getId(),
                    "name", dw.getRequest().getCustomer().getName(),
                    "phone", dw.getRequest().getCustomer().getPhone()
            ));
            history.add(entry);
        }

        // Get confirmed work, but exclude requests that are already in deployed work
        List<ConfirmedWorker> confirmedWork = confirmedWorkerRepository.findByWorkerOrderByConfirmedAtDesc(worker);
        for (ConfirmedWorker cw : confirmedWork) {
            // Only add if this request is not already in deployed work
            if (!deployedRequestIds.contains(cw.getRequest().getId())) {
                Map<String, Object> entry = new HashMap<>();
                entry.put("type", "confirmed");
                entry.put("requestId", cw.getRequest().getId());
                entry.put("workerTypes", cw.getRequest().getWorkerTypes() != null ? 
                    cw.getRequest().getWorkerTypes()
                        : new ArrayList<>());
                entry.put("workType", cw.getRequest().getWorkType());
                entry.put("startDate", cw.getRequest().getStartDate());
                entry.put("endDate", cw.getRequest().getEndDate());
                entry.put("location", cw.getRequest().getLocation());
                entry.put("status", cw.getRequest().getStatus());
                entry.put("date", cw.getConfirmedAt());
                entry.put("customer", Map.of(
                        "id", cw.getRequest().getCustomer().getId(),
                        "name", cw.getRequest().getCustomer().getName(),
                        "phone", cw.getRequest().getCustomer().getPhone()
                ));
                history.add(entry);
            }
        }

        // Sort by date (most recent first)
        history.sort((a, b) -> {
            LocalDateTime dateA = (LocalDateTime) a.get("date");
            LocalDateTime dateB = (LocalDateTime) b.get("date");
            return dateB.compareTo(dateA);
        });

        return history;
    }

    @Transactional
    public User updateWorkerProfile(@NonNull Long userId, UpdateProfileDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check if email is being changed and if it's already taken
        if (!user.getEmail().equals(dto.getEmail()) && userRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("Email already exists");
        }

        user.setName(dto.getName());
        user.setEmail(dto.getEmail());
        user.setPhone(dto.getPhone());
        user.setSecondaryPhone(dto.getSecondaryPhone());

        if (dto.getLocation() != null) {
            Location location = new Location();
            location.setLatitude(dto.getLocation().getLatitude());
            location.setLongitude(dto.getLocation().getLongitude());
            location.setAddress(dto.getLocation().getAddress());
            user.setLocation(location);

            // Also update worker's current location if worker profile exists
            Worker worker = workerRepository.findByUserId(userId).orElse(null);
            if (worker != null) {
                Location currentLocation = new Location();
                currentLocation.setLatitude(dto.getLocation().getLatitude());
                currentLocation.setLongitude(dto.getLocation().getLongitude());
                currentLocation.setAddress(dto.getLocation().getAddress());
                worker.setCurrentLocation(currentLocation);
                workerRepository.save(worker);
            }
        }

        return userRepository.save(user);
    }
}

