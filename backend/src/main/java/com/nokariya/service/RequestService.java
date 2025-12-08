package com.nokariya.service;

import com.nokariya.dto.CreateRequestDto;
import com.nokariya.dto.LaborTypeRequirementDto;
import com.nokariya.model.*;
import com.nokariya.repository.RatingRepository;
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

    @Autowired
    private RatingRepository ratingRepository;

    private static final double EARTH_RADIUS_KM = 6371.0;

    @Transactional
    public Request createRequest(Long customerId, CreateRequestDto dto) {
        try {
            User customer = userRepository.findById(customerId)
                    .orElseThrow(() -> new RuntimeException("Customer not found"));

            // Validate labor type requirements
            if (dto.getLaborTypeRequirements() == null || dto.getLaborTypeRequirements().isEmpty()) {
                throw new RuntimeException("At least one labor type requirement is required");
            }

            // Validate date range
            if (dto.getEndDate().isBefore(dto.getStartDate())) {
                throw new RuntimeException("End date must be after start date");
            }

            // Validate location
            if (dto.getLocation() == null) {
                throw new RuntimeException("Location is required");
            }
            if (dto.getLocation().getAddress() == null || dto.getLocation().getAddress().trim().isEmpty()) {
                throw new RuntimeException("Address is required");
            }

            Request request = new Request();
            request.setCustomer(customer);
            request.setWorkType(dto.getWorkType());
            request.setStartDate(dto.getStartDate());
            request.setEndDate(dto.getEndDate());

            // Process labor type requirements
            List<Worker.LaborType> allLaborTypes = new ArrayList<>();
            int totalWorkers = 0;
            List<RequestLaborTypeRequirement> requirements = new ArrayList<>();
            
            for (LaborTypeRequirementDto req : dto.getLaborTypeRequirements()) {
                if (req.getLaborType() == null) {
                    throw new RuntimeException("Labor type cannot be null");
                }
                if (req.getNumberOfWorkers() == null || req.getNumberOfWorkers() < 1) {
                    throw new RuntimeException("Number of workers must be at least 1 for each labor type");
                }
                
                allLaborTypes.add(req.getLaborType());
                totalWorkers += req.getNumberOfWorkers();
                
                RequestLaborTypeRequirement requirement = new RequestLaborTypeRequirement();
                requirement.setRequest(request);
                requirement.setLaborType(req.getLaborType());
                requirement.setNumberOfWorkers(req.getNumberOfWorkers());
                requirements.add(requirement);
            }
            
            request.setLaborTypes(allLaborTypes); // Keep for backward compatibility
            request.setLaborTypeRequirements(requirements);
            request.setNumberOfWorkers(totalWorkers);

            Location location = new Location();
            location.setLatitude(dto.getLocation().getLatitude());
            location.setLongitude(dto.getLocation().getLongitude());
            location.setAddress(dto.getLocation().getAddress());
            if (dto.getLocation().getLandmark() != null && !dto.getLocation().getLandmark().trim().isEmpty()) {
                location.setLandmark(dto.getLocation().getLandmark());
            }
            request.setLocation(location);

            // Set status to pending admin approval instead of notifying workers directly
            request.setStatus(Request.RequestStatus.PENDING_ADMIN_APPROVAL);
            return requestRepository.save(request);
        } catch (Exception e) {
            // Log the error for debugging
            System.err.println("Error creating request: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to create request: " + e.getMessage(), e);
        }
    }

    @Transactional(readOnly = true)
    public List<Request> getMyRequests(Long customerId) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Customer not found"));
        List<Request> requests = requestRepository.findByCustomerOrderByCreatedAtDesc(customer);
        
        // Eagerly load laborTypeRequirements for each request to avoid lazy loading issues
        for (Request request : requests) {
            // Force load laborTypeRequirements
            if (request.getLaborTypeRequirements() != null) {
                request.getLaborTypeRequirements().size(); // Trigger lazy loading
            }
            
            // Populate worker ratings for deployed workers
            if (request.getDeployedWorkers() != null) {
                for (DeployedWorker dw : request.getDeployedWorkers()) {
                    // Initialize rating to 0.0 if not set
                    if (dw.getWorkerRating() == null) {
                        dw.setWorkerRating(0.0);
                    }
                    
                    if (dw.getWorker() != null && dw.getWorker().getId() != null) {
                        workerRepository.findByUserId(dw.getWorker().getId())
                                .ifPresent(worker -> {
                                    Double rating = worker.getRating() != null ? worker.getRating() : 0.0;
                                    dw.setWorkerRating(rating);
                                });
                    }
                }
            }
        }
        
        return requests;
    }

    @Transactional(readOnly = true)
    public List<Request> getAvailableRequests(Long workerId) {
        Worker worker = workerRepository.findByUserId(workerId)
                .orElseThrow(() -> new RuntimeException("Worker profile not found"));

        List<Request.RequestStatus> statuses = Arrays.asList(
                Request.RequestStatus.ADMIN_APPROVED,
                Request.RequestStatus.NOTIFIED
        );

        List<Request> requests = requestRepository.findByStatusIn(statuses).stream()
                .filter(request -> {
                    // Force load laborTypeRequirements and confirmedWorkers to avoid lazy loading issues
                    if (request.getLaborTypeRequirements() != null) {
                        request.getLaborTypeRequirements().size(); // Trigger lazy loading
                    }
                    if (request.getConfirmedWorkers() != null) {
                        request.getConfirmedWorkers().size(); // Trigger lazy loading
                    }
                    
                    // Check if all requirements are already met - if yes, exclude from available requests
                    boolean allRequirementsMet = true;
                    if (request.getLaborTypeRequirements() != null && !request.getLaborTypeRequirements().isEmpty()) {
                        // Group confirmed workers by labor type
                        Map<Worker.LaborType, Integer> confirmedByLaborType = new HashMap<>();
                        if (request.getConfirmedWorkers() != null) {
                            for (ConfirmedWorker cw : request.getConfirmedWorkers()) {
                                User workerUser = cw.getWorker();
                                Worker workerProfile = workerRepository.findByUserId(workerUser.getId()).orElse(null);
                                if (workerProfile != null && workerProfile.getLaborTypes() != null) {
                                    for (Worker.LaborType laborType : workerProfile.getLaborTypes()) {
                                        confirmedByLaborType.put(laborType, confirmedByLaborType.getOrDefault(laborType, 0) + 1);
                                    }
                                }
                            }
                        }
                        
                        // Check if all requirements are met
                        for (RequestLaborTypeRequirement req : request.getLaborTypeRequirements()) {
                            int confirmedCount = confirmedByLaborType.getOrDefault(req.getLaborType(), 0);
                            if (confirmedCount < req.getNumberOfWorkers()) {
                                allRequirementsMet = false;
                                break;
                            }
                        }
                    } else {
                        // Fallback: check total confirmed vs total required
                        int totalConfirmed = request.getConfirmedWorkers() != null ? request.getConfirmedWorkers().size() : 0;
                        allRequirementsMet = totalConfirmed >= request.getNumberOfWorkers();
                    }
                    
                    // Exclude requests where all requirements are met
                    if (allRequirementsMet) {
                        return false;
                    }
                    
                    // Check if worker has any of the required labor types
                    if (request.getLaborTypes() == null || request.getLaborTypes().isEmpty()) {
                        return false;
                    }
                    return request.getLaborTypes().stream()
                            .anyMatch(laborType -> worker.getLaborTypes().contains(laborType));
                })
                .collect(Collectors.toList());

        // Filter out requests that this worker has already confirmed
        List<Request> filteredRequests = new ArrayList<>();
        for (Request request : requests) {
            // Check if this worker has confirmed this request
            // Note: ConfirmedWorker.worker is a User, not a Worker
            boolean workerConfirmed = request.getConfirmedWorkers().stream()
                    .anyMatch(cw -> {
                        User confirmedWorkerUser = cw.getWorker();
                        return confirmedWorkerUser != null && 
                               confirmedWorkerUser.getId().equals(workerId);
                    });
            
            // Exclude requests that this worker has already confirmed
            if (workerConfirmed) {
                continue;
            }
            
            // Populate customer ratings
            if (request.getCustomer() != null && request.getCustomer().getId() != null) {
                // Calculate customer rating from ratings table
                List<Rating> customerRatings = ratingRepository.findByRated(request.getCustomer());
                if (customerRatings.isEmpty()) {
                    request.setCustomerRating(0.0);
                } else {
                    double averageRating = customerRatings.stream()
                            .mapToInt(Rating::getRating)
                            .average()
                            .orElse(0.0);
                    request.setCustomerRating(Math.round(averageRating * 10.0) / 10.0);
                }
            } else {
                request.setCustomerRating(0.0);
            }
            
            filteredRequests.add(request);
        }

        return filteredRequests;
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
        
        // Update status to CONFIRMED if we have any confirmations
        if (request.getStatus() == Request.RequestStatus.NOTIFIED) {
            request.setStatus(Request.RequestStatus.CONFIRMED);
        }

        // Save the request first to persist the confirmation
        Request savedRequest = requestRepository.save(request);
        
        // Note: The request will be automatically filtered out from other workers' available requests
        // in getAvailableRequests() if all requirements are met (checked per labor type)

        return savedRequest;
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

