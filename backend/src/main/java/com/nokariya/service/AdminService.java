package com.nokariya.service;

import com.nokariya.dto.LocationDto;
import com.nokariya.model.*;
import com.nokariya.model.SystemUser;
import com.nokariya.repository.RequestRepository;
import com.nokariya.repository.SystemUserRepository;
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

    @Autowired
    private SystemUserRepository systemUserRepository;

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final double ADMIN_RADIUS_KM = 20.0; // 20km radius for admin

    public List<Request> getPendingApprovalRequests(Long adminId) {
        List<Request> requests = requestRepository.findByStatusOrderByCreatedAtDesc(Request.RequestStatus.PENDING_ADMIN_APPROVAL);
        // Only filter by radius if admin is not a super admin
        if (adminId != null && !isSuperAdmin(adminId)) {
            return filterByAdminRadius(requests, adminId);
        }
        return requests;
    }

    public List<Request> getAllRequests(String search, String sortBy, String sortOrder, Long adminId) {
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
                            (request.getLaborTypes() != null && request.getLaborTypes().stream()
                                .anyMatch(lt -> lt.name().toLowerCase().contains(searchLower))) ||
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
        
        // Filter by admin radius if adminId is provided
        if (adminId != null) {
            allRequests = filterByAdminRadius(allRequests, adminId);
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

        // Find nearest available and verified workers for all required labor types
        Set<Worker> allAvailableWorkers = new HashSet<>();
        for (Worker.LaborType laborType : savedRequest.getLaborTypes()) {
            List<Worker> workers = workerRepository.findAvailableWorkersByLaborType(laborType);
            allAvailableWorkers.addAll(workers);
        }
        List<Worker> availableWorkers = new ArrayList<>(allAvailableWorkers);

        // Calculate distances and sort
        final Request finalRequest = savedRequest;
        List<WorkerDistance> workersWithDistance = availableWorkers.stream()
                .filter(worker -> worker.getVerified() != null && worker.getVerified() && // Only verified workers
                        worker.getCurrentLocation() != null &&
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

        // Send notifications via WebSocket to workers who match the required labor types
        // Only notify workers whose labor types match the request requirements
        Map<String, Object> notificationData = new HashMap<>();
        notificationData.put("requestId", finalRequest.getId());
        notificationData.put("laborTypes", finalRequest.getLaborTypes().stream()
                .map(Enum::name)
                .collect(Collectors.toList()));
        
        // Include labor type requirements with worker counts
        if (finalRequest.getLaborTypeRequirements() != null && !finalRequest.getLaborTypeRequirements().isEmpty()) {
            List<Map<String, Object>> laborTypeReqs = finalRequest.getLaborTypeRequirements().stream()
                    .map(req -> {
                        Map<String, Object> reqData = new HashMap<>();
                        reqData.put("laborType", req.getLaborType().name());
                        reqData.put("numberOfWorkers", req.getNumberOfWorkers());
                        return reqData;
                    })
                    .collect(Collectors.toList());
            notificationData.put("laborTypeRequirements", laborTypeReqs);
        }
        
        notificationData.put("workType", finalRequest.getWorkType());
        notificationData.put("numberOfWorkers", finalRequest.getNumberOfWorkers());
        notificationData.put("startDate", finalRequest.getStartDate() != null ? finalRequest.getStartDate().toString() : null);
        notificationData.put("endDate", finalRequest.getEndDate() != null ? finalRequest.getEndDate().toString() : null);
        notificationData.put("location", finalRequest.getLocation());
        notificationData.put("customerId", finalRequest.getCustomer().getId());
        notificationData.put("customerName", finalRequest.getCustomer().getName());
        notificationData.put("message", "New work request available in your area!");

        // Notify only workers whose labor types match the request
        int notifiedCount = 0;
        for (WorkerDistance wd : workersWithDistance) {
            Worker worker = wd.getWorker();
            // Check if worker has at least one matching labor type
            boolean hasMatchingLaborType = finalRequest.getLaborTypes().stream()
                    .anyMatch(laborType -> worker.getLaborTypes().contains(laborType));
            
            if (hasMatchingLaborType) {
                messagingTemplate.convertAndSend(
                        "/topic/worker/" + worker.getUser().getId(),
                        notificationData
                );
                notifiedCount++;
                System.out.println("Notified worker: " + worker.getUser().getName() + " (ID: " + worker.getUser().getId() + ") for request: " + finalRequest.getId());
            }
        }
        
        System.out.println("Total workers notified: " + notifiedCount + " out of " + workersWithDistance.size() + " available workers");

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

    // Helper method removed - now using Worker.LaborType directly in Request

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
    public Object createUser(Long creatingAdminId, String name, String email, String phone, String secondaryPhone, String password, User.UserRole role, LocationDto location, List<Worker.LaborType> laborTypes, Boolean isSuperAdmin) {
        // Check if email already exists in either table
        if (userRepository.existsByEmail(email) || systemUserRepository.existsByEmail(email)) {
            throw new RuntimeException("User with this email already exists");
        }

        // If creating admin user, create in SystemUser table
        if (role == User.UserRole.ADMIN) {
            // Check if regular admin is trying to create an admin user
            if (!isSuperAdmin(creatingAdminId)) {
                throw new RuntimeException("Only super admin can create admin users");
            }

            SystemUser systemUser = new SystemUser();
            systemUser.setName(name);
            systemUser.setEmail(email);
            systemUser.setPhone(phone);
            systemUser.setSecondaryPhone(secondaryPhone);
            systemUser.setPassword(passwordEncoder.encode(password));
            systemUser.setSuperAdmin(isSuperAdmin != null ? isSuperAdmin : false);
            systemUser.setBlocked(false);

            if (location != null) {
                Location loc = new Location();
                loc.setLatitude(location.getLatitude());
                loc.setLongitude(location.getLongitude());
                loc.setAddress(location.getAddress());
                systemUser.setLocation(loc);
            }

            return systemUserRepository.save(systemUser);
        }

        // For customer and worker, create in User table
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPhone(phone);
        user.setSecondaryPhone(secondaryPhone);
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
            // Note: Aadhaar number can be added later via profile update
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

    public List<Map<String, Object>> getAllWorkers(Long adminId) {
        List<Worker> workers = workerRepository.findAll();
        
        // Filter by admin radius if adminId is provided and admin is not a super admin
        if (adminId != null && !isSuperAdmin(adminId)) {
            workers = filterWorkersByAdminRadius(workers, adminId);
        }
        
        return workers.stream().map(worker -> {
            Map<String, Object> workerData = new HashMap<>();
            workerData.put("id", worker.getId());
            workerData.put("userId", worker.getUser().getId());
            workerData.put("name", worker.getUser().getName());
            workerData.put("email", worker.getUser().getEmail());
            workerData.put("phone", worker.getUser().getPhone());
            workerData.put("secondaryPhone", worker.getUser().getSecondaryPhone());
            workerData.put("laborTypes", worker.getLaborTypes());
            workerData.put("rating", worker.getRating());
            workerData.put("totalJobs", worker.getTotalJobs());
            workerData.put("available", worker.getAvailable());
            workerData.put("verified", worker.getVerified() != null ? worker.getVerified() : false);
            workerData.put("blocked", worker.getUser().getBlocked() != null ? worker.getUser().getBlocked() : false);
            workerData.put("currentLocation", worker.getCurrentLocation());
            workerData.put("createdAt", worker.getCreatedAt());
            return workerData;
        }).collect(Collectors.toList());
    }

    public List<Map<String, Object>> getAllCustomers(Long adminId) {
        List<User> customers = userRepository.findAll().stream()
                .filter(user -> user.getRole() == User.UserRole.CUSTOMER)
                .collect(Collectors.toList());
        
        // Filter by admin radius if adminId is provided and admin is not a super admin
        if (adminId != null && !isSuperAdmin(adminId)) {
            customers = filterCustomersByAdminRadius(customers, adminId);
        }
        
        return customers.stream().map(customer -> {
            Map<String, Object> customerData = new HashMap<>();
            customerData.put("id", customer.getId());
            customerData.put("name", customer.getName());
            customerData.put("email", customer.getEmail());
            customerData.put("phone", customer.getPhone());
            customerData.put("secondaryPhone", customer.getSecondaryPhone());
            customerData.put("blocked", customer.getBlocked() != null ? customer.getBlocked() : false);
            customerData.put("location", customer.getLocation());
            customerData.put("createdAt", customer.getCreatedAt());
            return customerData;
        }).collect(Collectors.toList());
    }

    @Transactional
    public Worker toggleWorkerVerification(Long workerId) {
        Worker worker = workerRepository.findById(workerId)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        
        worker.setVerified(worker.getVerified() == null || !worker.getVerified());
        return workerRepository.save(worker);
    }


    @Transactional
    public User toggleUserBlockStatus(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Don't allow blocking admin users
        if (user.getRole() == User.UserRole.ADMIN) {
            throw new RuntimeException("Cannot block admin users");
        }
        
        user.setBlocked(user.getBlocked() == null || !user.getBlocked());
        return userRepository.save(user);
    }

    // Helper method to filter requests by admin radius
    private List<Request> filterByAdminRadius(List<Request> requests, Long adminId) {
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("Admin not found"));
        
        // If admin has no location, return all requests
        if (admin.getLocation() == null || admin.getLocation().getLatitude() == null || admin.getLocation().getLongitude() == null) {
            return requests;
        }
        
        double adminLat = admin.getLocation().getLatitude();
        double adminLon = admin.getLocation().getLongitude();
        
        return requests.stream()
                .filter(request -> {
                    if (request.getLocation() == null || request.getLocation().getLatitude() == null || request.getLocation().getLongitude() == null) {
                        return false;
                    }
                    double distance = calculateDistance(
                            adminLat, adminLon,
                            request.getLocation().getLatitude(),
                            request.getLocation().getLongitude()
                    );
                    return distance <= ADMIN_RADIUS_KM;
                })
                .collect(Collectors.toList());
    }

    // Helper method to filter workers by admin radius
    private List<Worker> filterWorkersByAdminRadius(List<Worker> workers, Long adminId) {
        Location adminLocation = null;
        
        // Check if it's a system user (negative ID) or regular user
        if (adminId < 0) {
            // System user
            Long systemUserId = Math.abs(adminId);
            SystemUser systemUser = systemUserRepository.findById(systemUserId)
                    .orElseThrow(() -> new RuntimeException("Admin not found"));
            adminLocation = systemUser.getLocation();
        } else {
            // Regular user (legacy admin)
            User admin = userRepository.findById(adminId)
                    .orElseThrow(() -> new RuntimeException("Admin not found"));
            adminLocation = admin.getLocation();
        }
        
        // If admin has no location, return all workers
        if (adminLocation == null || adminLocation.getLatitude() == null || adminLocation.getLongitude() == null) {
            return workers;
        }
        
        double adminLat = adminLocation.getLatitude();
        double adminLon = adminLocation.getLongitude();
        
        return workers.stream()
                .filter(worker -> {
                    if (worker.getCurrentLocation() == null || worker.getCurrentLocation().getLatitude() == null || worker.getCurrentLocation().getLongitude() == null) {
                        return false;
                    }
                    double distance = calculateDistance(
                            adminLat, adminLon,
                            worker.getCurrentLocation().getLatitude(),
                            worker.getCurrentLocation().getLongitude()
                    );
                    return distance <= ADMIN_RADIUS_KM;
                })
                .collect(Collectors.toList());
    }

    // Helper method to filter customers by admin radius
    private List<User> filterCustomersByAdminRadius(List<User> customers, Long adminId) {
        Location adminLocation = null;
        
        // Check if it's a system user (negative ID) or regular user
        if (adminId < 0) {
            // System user
            Long systemUserId = Math.abs(adminId);
            SystemUser systemUser = systemUserRepository.findById(systemUserId)
                    .orElseThrow(() -> new RuntimeException("Admin not found"));
            adminLocation = systemUser.getLocation();
        } else {
            // Regular user (legacy admin)
            User admin = userRepository.findById(adminId)
                    .orElseThrow(() -> new RuntimeException("Admin not found"));
            adminLocation = admin.getLocation();
        }
        
        // If admin has no location, return all customers
        if (adminLocation == null || adminLocation.getLatitude() == null || adminLocation.getLongitude() == null) {
            return customers;
        }
        
        double adminLat = adminLocation.getLatitude();
        double adminLon = adminLocation.getLongitude();
        
        return customers.stream()
                .filter(customer -> {
                    if (customer.getLocation() == null || customer.getLocation().getLatitude() == null || customer.getLocation().getLongitude() == null) {
                        return false;
                    }
                    double distance = calculateDistance(
                            adminLat, adminLon,
                            customer.getLocation().getLatitude(),
                            customer.getLocation().getLongitude()
                    );
                    return distance <= ADMIN_RADIUS_KM;
                })
                .collect(Collectors.toList());
    }

    // Helper method to check if admin is a super admin
    private boolean isSuperAdmin(Long adminId) {
        if (adminId == null) {
            System.err.println("isSuperAdmin: adminId is null");
            return false;
        }
        
        System.out.println("isSuperAdmin check for adminId: " + adminId);
        
        // Check if it's a system user (negative ID) or regular user
        if (adminId < 0) {
            // System user - use absolute value to get the actual ID
            Long systemUserId = Math.abs(adminId);
            System.out.println("Checking system user with ID: " + systemUserId);
            java.util.Optional<SystemUser> systemUserOpt = systemUserRepository.findById(systemUserId);
            if (systemUserOpt.isPresent()) {
                SystemUser systemUser = systemUserOpt.get();
                boolean isSuper = systemUser.getSuperAdmin() != null && systemUser.getSuperAdmin();
                System.out.println("System user found. SuperAdmin: " + isSuper);
                return isSuper;
            } else {
                System.err.println("System user not found with ID: " + systemUserId);
                return false;
            }
        } else {
            // Regular user (legacy admin) - should not happen for system users, but handle it
            System.out.println("Checking regular user with ID: " + adminId);
            java.util.Optional<User> userOpt = userRepository.findById(adminId);
            if (userOpt.isPresent()) {
                User admin = userOpt.get();
                boolean isSuper = admin.getSuperAdmin() != null && admin.getSuperAdmin();
                System.out.println("Regular user found. SuperAdmin: " + isSuper);
                return isSuper;
            } else {
                System.err.println("Regular user not found with ID: " + adminId);
                return false;
            }
        }
    }

    public List<Map<String, Object>> getAllSystemUsers(Long adminId) {
        System.out.println("getAllSystemUsers called with adminId: " + adminId);
        System.out.println("AdminId type: " + (adminId != null ? adminId.getClass().getName() : "null"));
        System.out.println("AdminId value: " + adminId);
        
        // Only super admin can see all system users
        try {
            boolean isSuper = isSuperAdmin(adminId);
            System.out.println("Is super admin: " + isSuper);
            if (!isSuper) {
                System.err.println("User is not a super admin. AdminId: " + adminId);
                throw new RuntimeException("Only super admin can view system users");
            }
        } catch (Exception e) {
            System.err.println("Error checking super admin status: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to verify super admin status: " + e.getMessage(), e);
        }

        List<SystemUser> systemUsers = systemUserRepository.findAll();
        System.out.println("Found " + systemUsers.size() + " system users");
        return systemUsers.stream().map(systemUser -> {
            Map<String, Object> userData = new HashMap<>();
            userData.put("id", systemUser.getId());
            userData.put("name", systemUser.getName());
            userData.put("email", systemUser.getEmail());
            userData.put("phone", systemUser.getPhone());
            userData.put("secondaryPhone", systemUser.getSecondaryPhone());
            userData.put("superAdmin", systemUser.getSuperAdmin() != null ? systemUser.getSuperAdmin() : false);
            userData.put("blocked", systemUser.getBlocked() != null ? systemUser.getBlocked() : false);
            userData.put("location", systemUser.getLocation());
            userData.put("createdAt", systemUser.getCreatedAt());
            return userData;
        }).collect(Collectors.toList());
    }
}

