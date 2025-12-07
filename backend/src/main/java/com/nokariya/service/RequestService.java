package com.nokariya.service;

import com.nokariya.dto.CreateRequestDto;
import com.nokariya.model.*;
import com.nokariya.repository.RequestRepository;
import com.nokariya.repository.UserRepository;
import com.nokariya.repository.WorkerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RequestService {
    @Autowired
    private RequestRepository requestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private static final double EARTH_RADIUS_KM = 6371.0;

    @Transactional
    public Request createRequest(Long customerId, CreateRequestDto dto) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Customer not found"));

        Request request = new Request();
        request.setCustomer(customer);
        request.setLaborType(convertLaborType(dto.getLaborType()));
        request.setWorkType(dto.getWorkType());
        request.setNumberOfWorkers(dto.getNumberOfWorkers());

        Location location = new Location();
        location.setLatitude(dto.getLocation().getLatitude());
        location.setLongitude(dto.getLocation().getLongitude());
        location.setAddress(dto.getLocation().getAddress());
        request.setLocation(location);

        // Set status to pending admin approval instead of notifying workers directly
        request.setStatus(Request.RequestStatus.PENDING_ADMIN_APPROVAL);
        return requestRepository.save(request);
    }

    public List<Request> getMyRequests(Long customerId) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Customer not found"));
        return requestRepository.findByCustomerOrderByCreatedAtDesc(customer);
    }

    public List<Request> getAvailableRequests(Long workerId) {
        Worker worker = workerRepository.findByUserId(workerId)
                .orElseThrow(() -> new RuntimeException("Worker profile not found"));

        List<Request.RequestStatus> statuses = Arrays.asList(
                Request.RequestStatus.PENDING,
                Request.RequestStatus.NOTIFIED
        );

        return requestRepository.findByStatusIn(statuses).stream()
                .filter(request -> worker.getLaborTypes().contains(
                        convertToWorkerLaborType(request.getLaborType())
                ))
                .collect(Collectors.toList());
    }

    @Transactional
    public Request confirmRequest(Long requestId, Long workerId) {
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        User worker = userRepository.findById(workerId)
                .orElseThrow(() -> new RuntimeException("Worker not found"));

        // Check if already confirmed
        boolean alreadyConfirmed = request.getConfirmedWorkers().stream()
                .anyMatch(cw -> cw.getWorker().getId().equals(workerId));

        if (alreadyConfirmed) {
            throw new RuntimeException("Already confirmed this request");
        }

        // Add to confirmed workers
        ConfirmedWorker confirmedWorker = new ConfirmedWorker();
        confirmedWorker.setRequest(request);
        confirmedWorker.setWorker(worker);
        request.getConfirmedWorkers().add(confirmedWorker);

        // If we have enough confirmations, deploy workers
        if (request.getConfirmedWorkers().size() >= request.getNumberOfWorkers()) {
            request.setStatus(Request.RequestStatus.CONFIRMED);
            // Deploy workers
            request.getConfirmedWorkers().stream()
                    .limit(request.getNumberOfWorkers())
                    .forEach(cw -> {
                        DeployedWorker deployedWorker = new DeployedWorker();
                        deployedWorker.setRequest(request);
                        deployedWorker.setWorker(cw.getWorker());
                        request.getDeployedWorkers().add(deployedWorker);
                    });
            request.setStatus(Request.RequestStatus.DEPLOYED);

            // Notify customer
            Map<String, Object> deploymentData = new HashMap<>();
            deploymentData.put("requestId", request.getId());
            deploymentData.put("deployedWorkers", request.getDeployedWorkers().stream()
                    .map(dw -> {
                        Map<String, Object> workerData = new HashMap<>();
                        workerData.put("id", dw.getWorker().getId());
                        workerData.put("name", dw.getWorker().getName());
                        return workerData;
                    })
                    .collect(Collectors.toList()));
            messagingTemplate.convertAndSend(
                    "/topic/customer/" + request.getCustomer().getId(),
                    deploymentData
            );
        }

        return requestRepository.save(request);
    }

    @Transactional
    public Request completeRequest(Long requestId, Long customerId) {
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (!request.getCustomer().getId().equals(customerId)) {
            throw new RuntimeException("Not authorized");
        }

        request.setStatus(Request.RequestStatus.COMPLETED);
        request.setCompletedAt(java.time.LocalDateTime.now());
        return requestRepository.save(request);
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    private Request.LaborType convertLaborType(Request.LaborType type) {
        return type; // Same enum
    }

    private Worker.LaborType convertToWorkerLaborType(Request.LaborType type) {
        return Worker.LaborType.valueOf(type.name());
    }

    private static class WorkerDistance {
        private final Worker worker;
        private final double distance;

        public WorkerDistance(Worker worker, double distance) {
            this.worker = worker;
            this.distance = distance;
        }

        public Worker getWorker() {
            return worker;
        }

        public double getDistance() {
            return distance;
        }
    }
}

