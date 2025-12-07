package com.nokariya.service;

import com.nokariya.dto.LocationDto;
import com.nokariya.model.Location;
import com.nokariya.model.Worker;
import com.nokariya.repository.UserRepository;
import com.nokariya.repository.WorkerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
public class WorkerService {
    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private UserRepository userRepository;

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
}

