package com.nokariya.service;

import com.nokariya.dto.LocationDto;
import com.nokariya.model.*;
import com.nokariya.repository.RequestRepository;
import com.nokariya.repository.UserRepository;
import com.nokariya.repository.WorkerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminService {

    @Autowired
    private RequestRepository requestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final double EARTH_RADIUS_KM = 6371.0;

    public List<Request> getPendingApprovalRequests() {
        return requestRepository.findByStatusOrderByCreatedAtDesc(Request.RequestStatus.PENDING_ADMIN_APPROVAL);
    }

    public List<Request> getAllRequests(String search, String sortBy, String sortOrder) {
        List<Request> allRequests = requestRepository.findAll();
        
        // Apply search filter
        if (search != null && !search.trim().isEmpty()) {
            String searchLower = search.toLowerCase();
            allRequests = allRequests.stream()
                    .filter(request -> 
                            request.getWorkType().toLowerCase().contains(searchLower) ||
                            request.getCustomer().getName().toLowerCase().contains(searchLower) ||
                            request.getCustomer().getEmail().toLowerCase().contains(searchLower) ||
                            request.getCustomer().getPhone().toLowerCase().contains(searchLower) ||
                            (request.getLocation() != null && request.getLocation().getAddress() != null && 
                             request.getLocation().getAddress().toLowerCase().contains(searchLower)) ||
                            request.getLaborType().name().toLowerCase().contains(searchLower) ||
                            request.getStatus().name().toLowerCase().contains(searchLower)
                    )
                    .collect(Collectors.toList());
        }
        
        // Apply sorting
        if (sortBy != null && !sortBy.trim().isEmpty()) {
            Comparator<Request> comparator = switch (sortBy.toLowerCase()) {
                case "date" -> Comparator.comparing(Request::getCreatedAt);
                case "status" -> Comparator.comparing(Request::getStatus);
                case "worktype" -> Comparator.comparing(Request::getWorkType);
                case "customername" -> Comparator.comparing(r -> r.getCustomer().getName());
                default -> Comparator.comparing(Request::getCreatedAt);
            };
            
            if ("desc".equalsIgnoreCase(sortOrder) || sortOrder == null) {
                comparator = comparator.reversed();
            }
            
            allRequests = allRequests.stream()
                    .sorted(comparator)
                    .collect(Collectors.toList());
        } else {
            // Default sort by date descending
            allRequests = allRequests.stream()
                    .sorted(Comparator.comparing(Request::getCreatedAt).reversed())
                    .collect(Collectors.toList());
        }
        
        return allRequests;
    }

    @Transactional
    public Request approveRequest(Long requestId) {
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (request.getStatus() != Request.RequestStatus.PENDING_ADMIN_APPROVAL) {
            throw new RuntimeException("Request is not pending admin approval");
        }

        // Update status to approved
        request.setStatus(Request.RequestStatus.ADMIN_APPROVED);
        Request savedRequest = requestRepository.save(request);

        // Find nearest available workers
        List<Worker> availableWorkers = workerRepository.findAvailableWorkersByLaborType(
                convertToWorkerLaborType(savedRequest.getLaborType())
        );

        // Calculate distances and sort
        final Request finalRequest = savedRequest;
        List<WorkerDistance> workersWithDistance = availableWorkers.stream()
                .filter(worker -> worker.getCurrentLocation() != null &&
                        worker.getCurrentLocation().getLatitude() != null &&
                        finalRequest.getLocation() != null &&
                        finalRequest.getLocation().getLatitude() != null)
                .map(worker -> {
                    double distance = calculateDistance(
                            finalRequest.getLocation().getLatitude(),
                            finalRequest.getLocation().getLongitude(),
                            worker.getCurrentLocation().getLatitude(),
                            worker.getCurrentLocation().getLongitude()
                    );
                    return new WorkerDistance(worker, distance);
                })
                .sorted(Comparator.comparing(WorkerDistance::getDistance))
                .limit(finalRequest.getNumberOfWorkers() * 3) // Notify 3x the required workers
                .collect(Collectors.toList());

        // Send notifications via WebSocket
        Map<String, Object> notificationData = new HashMap<>();
        notificationData.put("requestId", finalRequest.getId());
        notificationData.put("laborType", finalRequest.getLaborType().name());
        notificationData.put("workType", finalRequest.getWorkType());
        notificationData.put("numberOfWorkers", finalRequest.getNumberOfWorkers());
        notificationData.put("location", finalRequest.getLocation());
        notificationData.put("customerId", finalRequest.getCustomer().getId());

        workersWithDistance.forEach(wd -> {
            messagingTemplate.convertAndSend(
                    "/topic/worker/" + wd.getWorker().getUser().getId(),
                    notificationData
            );
        });

        // Update status to NOTIFIED after sending to workers
        finalRequest.setStatus(Request.RequestStatus.NOTIFIED);
        return requestRepository.save(finalRequest);
    }

    @Transactional
    public Request rejectRequest(Long requestId) {
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (request.getStatus() != Request.RequestStatus.PENDING_ADMIN_APPROVAL) {
            throw new RuntimeException("Request is not pending admin approval");
        }

        request.setStatus(Request.RequestStatus.REJECTED);
        return requestRepository.save(request);
    }

    private Worker.LaborType convertToWorkerLaborType(Request.LaborType laborType) {
        return switch (laborType) {
            case ELECTRICIAN -> Worker.LaborType.ELECTRICIAN;
            case SKILLED -> Worker.LaborType.SKILLED;
            case UNSKILLED -> Worker.LaborType.UNSKILLED;
        };
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

    @Transactional
    public User createUser(String name, String email, String phone, String password, User.UserRole role, LocationDto location, List<Worker.LaborType> laborTypes) {
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("User with this email already exists");
        }

        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPhone(phone);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(role);

        if (location != null) {
            Location loc = new Location();
            loc.setLatitude(location.getLatitude());
            loc.setLongitude(location.getLongitude());
            loc.setAddress(location.getAddress());
            user.setLocation(loc);
        }

        user = userRepository.save(user);

        // If worker, create worker profile
        if (role == User.UserRole.WORKER && laborTypes != null && !laborTypes.isEmpty()) {
            Worker worker = new Worker();
            worker.setUser(user);
            worker.setLaborTypes(laborTypes);
            if (location != null) {
                Location currentLocation = new Location();
                currentLocation.setLatitude(location.getLatitude());
                currentLocation.setLongitude(location.getLongitude());
                currentLocation.setAddress(location.getAddress());
                worker.setCurrentLocation(currentLocation);
            }
            workerRepository.save(worker);
        }

        return user;
    }

    @Transactional
    public User updateAdminPassword(String email, String newPassword) {
        User admin = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Admin user not found"));
        
        if (admin.getRole() != User.UserRole.ADMIN) {
            throw new RuntimeException("User is not an admin");
        }
        
        admin.setPassword(passwordEncoder.encode(newPassword));
        return userRepository.save(admin);
    }
}

