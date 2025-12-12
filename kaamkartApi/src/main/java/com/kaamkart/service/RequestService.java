package com.kaamkart.service;

import com.kaamkart.dto.CreateRequestDto;
import com.kaamkart.dto.WorkerTypeRequirementDto;
import com.kaamkart.model.*;
import com.kaamkart.model.RequestWorkerTypeRequirement;
import com.kaamkart.repository.RatingRepository;
import com.kaamkart.repository.RequestRepository;
import com.kaamkart.repository.UserRepository;
import com.kaamkart.repository.WorkerRepository;
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
                // Priority 2: Use address fields (State, City, Pin Code, Area) for geocoding
                if (dto.getLocation().getState() != null && !dto.getLocation().getState().trim().isEmpty()
                        && dto.getLocation().getCity() != null && !dto.getLocation().getCity().trim().isEmpty()
                        && dto.getLocation().getPinCode() != null && !dto.getLocation().getPinCode().trim().isEmpty()) {
                    
                    // Geocode the address to get latitude and longitude
                    double[] coordinates = geocodeAddress(
                            dto.getLocation().getState(),
                            dto.getLocation().getCity(),
                            dto.getLocation().getPinCode(),
                            dto.getLocation().getArea()
                    );
                    
                    // Set coordinates if geocoding was successful, otherwise leave as null
                    if (coordinates != null && coordinates.length == 2) {
                        location.setLatitude(coordinates[0]);
                        location.setLongitude(coordinates[1]);
                    }
                    // If geocoding fails, lat/long will remain null but address will be stored
                    
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
                    if (dto.getLocation().getPinCode() != null && !dto.getLocation().getPinCode().trim().isEmpty()) {
                        addressBuilder.append(dto.getLocation().getPinCode());
                    }
                    location.setAddress(addressBuilder.toString().trim());
                } else {
                    // Fallback: Use provided address if available
                    if (dto.getLocation().getAddress() != null && !dto.getLocation().getAddress().trim().isEmpty()) {
                        location.setAddress(dto.getLocation().getAddress());
                        // Try to geocode the address string
                        double[] coordinates = geocodeAddressString(dto.getLocation().getAddress());
                        if (coordinates != null) {
                            location.setLatitude(coordinates[0]);
                            location.setLongitude(coordinates[1]);
                        }
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

    /**
     * Geocode address components to get latitude and longitude
     * This is a placeholder implementation. In production, integrate with a geocoding service
     * like Google Maps Geocoding API, OpenStreetMap Nominatim, or similar.
     * 
     * @param state State name
     * @param city City name
     * @param pinCode Pin code
     * @param area Area/locality (optional)
     * @return double array with [latitude, longitude] or null if geocoding is not available
     */
    private double[] geocodeAddress(String state, String city, String pinCode, String area) {
        // TODO: Integrate with a geocoding service (Google Maps, OpenStreetMap, etc.)
        // 
        // Example with OpenStreetMap Nominatim (free, no API key required):
        // String query = String.format("%s, %s, %s, %s", 
        //     area != null ? area : "", city, state, pinCode);
        // String url = "https://nominatim.openstreetmap.org/search?q=" + 
        //     URLEncoder.encode(query, StandardCharsets.UTF_8) + "&format=json&limit=1";
        // Make HTTP request, parse JSON response to get lat/lon
        //
        // Example with Google Maps Geocoding API (requires API key):
        // String address = String.format("%s, %s, %s %s", area, city, state, pinCode);
        // String url = "https://maps.googleapis.com/maps/api/geocode/json?address=" + 
        //     URLEncoder.encode(address, StandardCharsets.UTF_8) + "&key=YOUR_API_KEY";
        // Make HTTP request, parse JSON response to get lat/lon
        
        // For now, return null to indicate geocoding is not available
        // The system will still work with address fields, but location-based matching
        // will be limited until geocoding is implemented
        logger.warn("Geocoding not implemented for address: {}, {}, {}, {}. Address will be stored but lat/long will be null.", 
                state, city, pinCode, area);
        return null; // Return null to indicate geocoding unavailable
    }
    
    /**
     * Geocode an address string to get latitude and longitude
     * This is a placeholder implementation for geocoding a full address string.
     * 
     * @param address Full address string
     * @return double array with [latitude, longitude] or null if geocoding fails
     */
    private double[] geocodeAddressString(String address) {
        // TODO: Integrate with a geocoding service
        // For now, return null to indicate geocoding is not available
        return null;
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

