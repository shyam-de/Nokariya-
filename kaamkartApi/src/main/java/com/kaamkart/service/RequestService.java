package com.kaamkart.service;

import com.kaamkart.dto.CreateRequestDto;
import com.kaamkart.dto.WorkerTypeRequirementDto;
import com.kaamkart.model.*;
import com.kaamkart.model.RequestWorkerTypeRequirement;
import com.kaamkart.repository.RatingRepository;
import com.kaamkart.repository.RequestRepository;
import com.kaamkart.repository.UserRepository;
import com.kaamkart.repository.WorkerRepository;
import com.kaamkart.repository.ConfirmedWorkerRepository;
import com.kaamkart.repository.DeployedWorkerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RequestService {
    
    private static final Logger logger = LoggerFactory.getLogger(RequestService.class);
    
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

    @Autowired
    private PinCodeGeocodingService pinCodeGeocodingService;

    @Autowired
    private ConfirmedWorkerRepository confirmedWorkerRepository;

    @Autowired
    private DeployedWorkerRepository deployedWorkerRepository;

    private static final double EARTH_RADIUS_KM = 6371.0;

    @Transactional
    public Request createRequest(Long customerId, CreateRequestDto dto) {
        try {
            User customer = userRepository.findById(customerId)
                    .orElseThrow(() -> new RuntimeException("Customer not found"));

            // Validate labor type requirements
            if (dto.getWorkerTypeRequirements() == null || dto.getWorkerTypeRequirements().isEmpty()) {
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
            
            // Validate that either current location (lat/long) or address fields are provided
            boolean hasCurrentLocation = dto.getLocation().getLatitude() != null 
                    && dto.getLocation().getLongitude() != null
                    && dto.getLocation().getLatitude() != 0 
                    && dto.getLocation().getLongitude() != 0;
            
            boolean hasAddressFields = dto.getLocation().getState() != null 
                    && !dto.getLocation().getState().trim().isEmpty()
                    && dto.getLocation().getCity() != null 
                    && !dto.getLocation().getCity().trim().isEmpty()
                    && dto.getLocation().getPinCode() != null 
                    && !dto.getLocation().getPinCode().trim().isEmpty();
            
            boolean hasAddressString = dto.getLocation().getAddress() != null 
                    && !dto.getLocation().getAddress().trim().isEmpty();
            
            if (!hasCurrentLocation && !hasAddressFields && !hasAddressString) {
                throw new RuntimeException("Either current location (latitude/longitude) or address fields (State, City, Pin Code) or address string is required");
            }

            Request request = new Request();
            request.setCustomer(customer);
            request.setWorkType(dto.getWorkType());
            request.setStartDate(dto.getStartDate());
            request.setEndDate(dto.getEndDate());

            // Process labor type requirements
            List<String> allWorkerTypes = new ArrayList<>();
            int totalWorkers = 0;
            List<RequestWorkerTypeRequirement> requirements = new ArrayList<>();
            
            for (WorkerTypeRequirementDto req : dto.getWorkerTypeRequirements()) {
                if (req.getWorkerType() == null) {
                    throw new RuntimeException("Worker type cannot be null");
                }
                if (req.getNumberOfWorkers() == null || req.getNumberOfWorkers() < 1) {
                    throw new RuntimeException("Number of workers must be at least 1 for each worker type");
                }
                
                allWorkerTypes.add(req.getWorkerType());
                totalWorkers += req.getNumberOfWorkers();
                
                RequestWorkerTypeRequirement requirement = new RequestWorkerTypeRequirement();
                requirement.setRequest(request);
                requirement.setWorkerType(req.getWorkerType());
                requirement.setNumberOfWorkers(req.getNumberOfWorkers());
                requirements.add(requirement);
            }
            
            request.setWorkerTypes(allWorkerTypes); // Keep for backward compatibility
            request.setWorkerTypeRequirements(requirements);
            request.setNumberOfWorkers(totalWorkers);

            Location location = new Location();
            
            // Priority 1: Use current location (latitude/longitude) if provided
            if (dto.getLocation().getLatitude() != null && dto.getLocation().getLongitude() != null 
                    && dto.getLocation().getLatitude() != 0 && dto.getLocation().getLongitude() != 0) {
                location.setLatitude(dto.getLocation().getLatitude());
                location.setLongitude(dto.getLocation().getLongitude());
                location.setAddress(dto.getLocation().getAddress());
            } else {
                // Priority 2: Try to geocode pin code if provided
                String pinCode = dto.getLocation().getPinCode();
                if (pinCode != null && !pinCode.trim().isEmpty() && pinCode.matches("\\d{6}")) {
                    logger.info("📍 Geocoding pin code for request: {}", pinCode);
                    Location geocodedLocation = pinCodeGeocodingService.getLocationFromPinCode(pinCode);
                    if (geocodedLocation != null && geocodedLocation.getLatitude() != null && geocodedLocation.getLongitude() != null) {
                        location.setLatitude(geocodedLocation.getLatitude());
                        location.setLongitude(geocodedLocation.getLongitude());
                        // Use geocoded address if available, otherwise build from components
                        if (geocodedLocation.getAddress() != null && !geocodedLocation.getAddress().startsWith("Pin Code:")) {
                            location.setAddress(geocodedLocation.getAddress());
                        } else {
                            // Build address string from components
                            StringBuilder addressBuilder = new StringBuilder();
                            if (dto.getLocation().getArea() != null && !dto.getLocation().getArea().trim().isEmpty()) {
                                addressBuilder.append(dto.getLocation().getArea()).append(", ");
                            }
                            if (dto.getLocation().getCity() != null && !dto.getLocation().getCity().trim().isEmpty()) {
                                addressBuilder.append(dto.getLocation().getCity()).append(", ");
                            }
                            if (dto.getLocation().getState() != null && !dto.getLocation().getState().trim().isEmpty()) {
                                addressBuilder.append(dto.getLocation().getState()).append(" ");
                            }
                            addressBuilder.append(pinCode);
                            location.setAddress(addressBuilder.toString().trim());
                        }
                        logger.info("✅ Geocoded request pin code {}: lat={}, lon={}, address={}", 
                                pinCode, geocodedLocation.getLatitude(), geocodedLocation.getLongitude(), location.getAddress());
                    } else {
                        // Geocoding failed, use address fields
                        logger.warn("⚠️ Failed to geocode pin code {} for request, using address only", pinCode);
                        if (dto.getLocation().getState() != null && !dto.getLocation().getState().trim().isEmpty()
                                && dto.getLocation().getCity() != null && !dto.getLocation().getCity().trim().isEmpty()) {
                            StringBuilder addressBuilder = new StringBuilder();
                            if (dto.getLocation().getArea() != null && !dto.getLocation().getArea().trim().isEmpty()) {
                                addressBuilder.append(dto.getLocation().getArea()).append(", ");
                            }
                            addressBuilder.append(dto.getLocation().getCity()).append(", ");
                            addressBuilder.append(dto.getLocation().getState()).append(" ").append(pinCode);
                            location.setAddress(addressBuilder.toString().trim());
                        } else if (dto.getLocation().getAddress() != null && !dto.getLocation().getAddress().trim().isEmpty()) {
                            location.setAddress(dto.getLocation().getAddress());
                        } else {
                            location.setAddress("Pin Code: " + pinCode);
                        }
                    }
                } else if (dto.getLocation().getState() != null && !dto.getLocation().getState().trim().isEmpty()
                        && dto.getLocation().getCity() != null && !dto.getLocation().getCity().trim().isEmpty()
                        && pinCode != null && !pinCode.trim().isEmpty()) {
                    // Build address string from components (pin code format invalid, but we have state/city)
                    StringBuilder addressBuilder = new StringBuilder();
                    if (dto.getLocation().getArea() != null && !dto.getLocation().getArea().trim().isEmpty()) {
                        addressBuilder.append(dto.getLocation().getArea()).append(", ");
                    }
                    addressBuilder.append(dto.getLocation().getCity()).append(", ");
                    addressBuilder.append(dto.getLocation().getState()).append(" ").append(pinCode);
                    location.setAddress(addressBuilder.toString().trim());
                    logger.warn("Request created without lat/long coordinates (invalid pin code format). Address: {}", location.getAddress());
                } else {
                    // Fallback: Use provided address string if available
                    if (dto.getLocation().getAddress() != null && !dto.getLocation().getAddress().trim().isEmpty()) {
                        location.setAddress(dto.getLocation().getAddress());
                        logger.warn("Request created without lat/long coordinates. Address: {}", location.getAddress());
                    } else {
                        throw new RuntimeException("Either current location (latitude/longitude) or address fields (State, City, Pin Code) are required");
                    }
                }
            }
            
            if (dto.getLocation().getLandmark() != null && !dto.getLocation().getLandmark().trim().isEmpty()) {
                location.setLandmark(dto.getLocation().getLandmark());
            }
            request.setLocation(location);

            // Set status to pending admin approval instead of notifying workers directly
            request.setStatus(Request.RequestStatus.PENDING_ADMIN_APPROVAL);
            return requestRepository.save(request);
        } catch (Exception e) {
            logger.error("Error creating request for customer {}: {}", customerId, e.getMessage(), e);
            throw new RuntimeException("Failed to create request: " + e.getMessage(), e);
        }
    }

    @Transactional(readOnly = true)
    public List<Request> getMyRequests(Long customerId) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Customer not found"));
        List<Request> requests = requestRepository.findByCustomerOrderByCreatedAtDesc(customer);
        
        // Eagerly load workerTypeRequirements for each request to avoid lazy loading issues
        for (Request request : requests) {
            // Force load workerTypeRequirements
            if (request.getWorkerTypeRequirements() != null) {
                request.getWorkerTypeRequirements().size(); // Trigger lazy loading
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

    @Transactional
    public List<Request> getAvailableRequests(Long workerId) {
        Worker worker = workerRepository.findByUserId(workerId)
                .orElseThrow(() -> new RuntimeException("Worker profile not found"));

        // Check and update worker availability based on deployment end dates
        // If worker's deployment end date has passed and request is not completed, make them available
        User workerUser = worker.getUser();
        if (workerUser != null) {
            List<DeployedWorker> deployments = deployedWorkerRepository.findByWorkerOrderByDeployedAtDesc(workerUser);
            java.time.LocalDate today = java.time.LocalDate.now();
            boolean hasActiveDeployment = false;
            
            for (DeployedWorker dw : deployments) {
                Request req = dw.getRequest();
                if (req != null && req.getEndDate() != null) {
                    // Check if deployment end date has passed and request is not completed
                    boolean endDatePassed = req.getEndDate().isBefore(today);
                    boolean notCompleted = req.getStatus() != Request.RequestStatus.COMPLETED;
                    
                    if (endDatePassed && notCompleted) {
                        // Worker's deployment has ended but request is not completed
                        // They should be available for new requests
                        logger.info("Worker {} (ID: {}) deployment end date ({}) has passed for request {} (status: {}). Worker should be available.",
                                workerUser.getName(), workerId, req.getEndDate(), req.getId(), req.getStatus());
                    } else if (!endDatePassed && notCompleted) {
                        // Worker still has active deployment
                        hasActiveDeployment = true;
                    }
                }
            }
            
            // Also check confirmed workers
            List<ConfirmedWorker> confirmations = confirmedWorkerRepository.findByWorkerOrderByConfirmedAtDesc(workerUser);
            for (ConfirmedWorker cw : confirmations) {
                Request req = cw.getRequest();
                if (req != null && req.getEndDate() != null) {
                    boolean endDatePassed = req.getEndDate().isBefore(today);
                    boolean notCompleted = req.getStatus() != Request.RequestStatus.COMPLETED;
                    
                    if (!endDatePassed && notCompleted) {
                        hasActiveDeployment = true;
                    }
                }
            }
            
            // Update worker availability if they don't have active deployments
            // Note: We don't automatically set them to available here, as the availability
            // is managed by the worker themselves. However, the notification system will
            // check end dates and allow notifications if end date has passed.
        }

        List<Request.RequestStatus> statuses = Arrays.asList(
                Request.RequestStatus.ADMIN_APPROVED,
                Request.RequestStatus.NOTIFIED
        );

        List<Request> requests = requestRepository.findByStatusIn(statuses).stream()
                .filter(request -> {
                    // Force load workerTypeRequirements and confirmedWorkers to avoid lazy loading issues
                    if (request.getWorkerTypeRequirements() != null) {
                        request.getWorkerTypeRequirements().size(); // Trigger lazy loading
                    }
                    if (request.getConfirmedWorkers() != null) {
                        request.getConfirmedWorkers().size(); // Trigger lazy loading
                    }
                    
                    // Check if all requirements are already met - if yes, exclude from available requests
                    boolean allRequirementsMet = true;
                    if (request.getWorkerTypeRequirements() != null && !request.getWorkerTypeRequirements().isEmpty()) {
                        // Group confirmed workers by labor type
                        Map<String, Integer> confirmedByWorkerType = new HashMap<>();
                        if (request.getConfirmedWorkers() != null) {
                            for (ConfirmedWorker cw : request.getConfirmedWorkers()) {
                                User workerUser = cw.getWorker();
                                Worker workerProfile = workerRepository.findByUserId(workerUser.getId()).orElse(null);
                                if (workerProfile != null && workerProfile.getWorkerTypes() != null) {
                                    for (String workerType : workerProfile.getWorkerTypes()) {
                                        confirmedByWorkerType.put(workerType, confirmedByWorkerType.getOrDefault(workerType, 0) + 1);
                                    }
                                }
                            }
                        }
                        
                        // Check if all requirements are met
                        for (RequestWorkerTypeRequirement req : request.getWorkerTypeRequirements()) {
                            int confirmedCount = confirmedByWorkerType.getOrDefault(req.getWorkerType(), 0);
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
                    if (request.getWorkerTypes() == null || request.getWorkerTypes().isEmpty()) {
                        return false;
                    }
                    return request.getWorkerTypes().stream()
                            .anyMatch(workerType -> worker.getWorkerTypes().contains(workerType));
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

        // Check if worker has any active requests (confirmed or deployed) that overlap with this request's date range
        java.time.LocalDate newRequestStartDate = request.getStartDate();
        java.time.LocalDate newRequestEndDate = request.getEndDate();
        
        if (newRequestStartDate == null || newRequestEndDate == null) {
            throw new RuntimeException("Request must have valid start and end dates");
        }

        // Check confirmed workers
        List<ConfirmedWorker> workerConfirmations = confirmedWorkerRepository.findByWorkerOrderByConfirmedAtDesc(worker);
        for (ConfirmedWorker cw : workerConfirmations) {
            Request existingRequest = cw.getRequest();
            if (existingRequest == null) continue;
            
            // Check if work period is still active (end date hasn't passed)
            boolean workPeriodActive = existingRequest.getEndDate() != null && 
                    (existingRequest.getEndDate().isAfter(java.time.LocalDate.now()) || 
                     existingRequest.getEndDate().isEqual(java.time.LocalDate.now()));
            
            // Check if request is not completed
            boolean notCompleted = existingRequest.getStatus() != Request.RequestStatus.COMPLETED;
            
            if (workPeriodActive && notCompleted) {
                // Check if dates overlap
                boolean datesOverlap = existingRequest.getStartDate() != null && existingRequest.getEndDate() != null &&
                        existingRequest.getStartDate().isBefore(newRequestEndDate) && 
                        existingRequest.getEndDate().isAfter(newRequestStartDate);
                
                if (datesOverlap) {
                    throw new RuntimeException(String.format(
                        "Cannot accept this request. You already have an active request (ID: %d) from %s to %s that overlaps with this request's dates (%s to %s). " +
                        "You can only accept a new request if its start date is after your current request's end date.",
                        existingRequest.getId(),
                        existingRequest.getStartDate(),
                        existingRequest.getEndDate(),
                        newRequestStartDate,
                        newRequestEndDate
                    ));
                }
                
                // Check if new request starts before existing request ends
                if (newRequestStartDate.isBefore(existingRequest.getEndDate())) {
                    throw new RuntimeException(String.format(
                        "Cannot accept this request. You have an active request (ID: %d) that ends on %s, but this new request starts on %s. " +
                        "You can only accept a new request if its start date is after your current request's end date (%s).",
                        existingRequest.getId(),
                        existingRequest.getEndDate(),
                        newRequestStartDate,
                        existingRequest.getEndDate()
                    ));
                }
            }
        }

        // Check deployed workers
        List<DeployedWorker> workerDeployments = deployedWorkerRepository.findByWorkerOrderByDeployedAtDesc(worker);
        for (DeployedWorker dw : workerDeployments) {
            Request existingRequest = dw.getRequest();
            if (existingRequest == null) continue;
            
            // Check if work period is still active (end date hasn't passed)
            boolean workPeriodActive = existingRequest.getEndDate() != null && 
                    (existingRequest.getEndDate().isAfter(java.time.LocalDate.now()) || 
                     existingRequest.getEndDate().isEqual(java.time.LocalDate.now()));
            
            // Check if request is not completed
            boolean notCompleted = existingRequest.getStatus() != Request.RequestStatus.COMPLETED;
            
            if (workPeriodActive && notCompleted) {
                // Check if dates overlap
                boolean datesOverlap = existingRequest.getStartDate() != null && existingRequest.getEndDate() != null &&
                        existingRequest.getStartDate().isBefore(newRequestEndDate) && 
                        existingRequest.getEndDate().isAfter(newRequestStartDate);
                
                if (datesOverlap) {
                    throw new RuntimeException(String.format(
                        "Cannot accept this request. You are currently deployed in request (ID: %d) from %s to %s that overlaps with this request's dates (%s to %s). " +
                        "You can only accept a new request if its start date is after your current deployment's end date.",
                        existingRequest.getId(),
                        existingRequest.getStartDate(),
                        existingRequest.getEndDate(),
                        newRequestStartDate,
                        newRequestEndDate
                    ));
                }
                
                // Check if new request starts before existing request ends
                if (newRequestStartDate.isBefore(existingRequest.getEndDate())) {
                    throw new RuntimeException(String.format(
                        "Cannot accept this request. You are currently deployed in request (ID: %d) that ends on %s, but this new request starts on %s. " +
                        "You can only accept a new request if its start date is after your current deployment's end date (%s).",
                        existingRequest.getId(),
                        existingRequest.getEndDate(),
                        newRequestStartDate,
                        existingRequest.getEndDate()
                    ));
                }
            }
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
        
        logger.info("✅ Worker {} (ID: {}) confirmed request {} (dates: {} to {})", 
                worker.getName(), workerId, requestId, newRequestStartDate, newRequestEndDate);

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
        Request savedRequest = requestRepository.save(request);
        
        // Make workers available again after work is completed
        // Workers remain unavailable until work is marked as COMPLETED, regardless of end date
        if (request.getDeployedWorkers() != null) {
            for (DeployedWorker dw : request.getDeployedWorkers()) {
                if (dw.getWorker() != null) {
                    Worker workerProfile = workerRepository.findByUserId(dw.getWorker().getId()).orElse(null);
                    if (workerProfile != null) {
                        workerProfile.setAvailable(true);
                        workerRepository.save(workerProfile);
                        logger.info("Worker {} (ID: {}) set to available after work completion (request ID: {}, end date: {})", 
                                dw.getWorker().getName(), dw.getWorker().getId(), request.getId(), request.getEndDate());
                    }
                }
            }
        }
        
        return savedRequest;
    }

    @Transactional
    public Request extendDeployedWorkerEndDate(Long requestId, Long workerId, Long customerId, java.time.LocalDate newEndDate) {
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        // Verify customer owns this request
        if (!request.getCustomer().getId().equals(customerId)) {
            throw new RuntimeException("Not authorized to extend end date for this request");
        }

        // Verify worker is deployed in this request
        boolean isDeployed = request.getDeployedWorkers().stream()
                .anyMatch(dw -> dw.getWorker().getId().equals(workerId));

        if (!isDeployed) {
            throw new RuntimeException("Worker is not deployed in this request");
        }

        // Validate new end date is after current end date
        if (newEndDate == null || request.getEndDate() == null) {
            throw new RuntimeException("Invalid end date");
        }

        if (newEndDate.isBefore(request.getEndDate()) || newEndDate.isEqual(request.getEndDate())) {
            throw new RuntimeException("New end date must be after the current end date");
        }

        // Update the request end date
        request.setEndDate(newEndDate);
        Request savedRequest = requestRepository.save(request);

        logger.info("✅ Customer {} (ID: {}) extended end date for worker {} (ID: {}) in request {} to {}", 
                request.getCustomer().getName(), customerId, 
                request.getDeployedWorkers().stream()
                        .filter(dw -> dw.getWorker().getId().equals(workerId))
                        .findFirst()
                        .map(dw -> dw.getWorker().getName())
                        .orElse("Unknown"),
                workerId, requestId, newEndDate);

        return savedRequest;
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

