package com.kaamkart.service;

import com.kaamkart.dto.LocationDto;
import com.kaamkart.model.*;
import com.kaamkart.model.SystemUser;
import com.kaamkart.repository.ConfirmedWorkerRepository;
import com.kaamkart.repository.DeployedWorkerRepository;
import com.kaamkart.repository.RequestRepository;
import com.kaamkart.repository.SystemUserRepository;
import com.kaamkart.repository.UserRepository;
import com.kaamkart.repository.WorkerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;
import java.util.ArrayList;

@Service
public class AdminService {

    private static final Logger logger = LoggerFactory.getLogger(AdminService.class);

    @Autowired
    private RequestRepository requestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private ConfirmedWorkerRepository confirmedWorkerRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private SystemUserRepository systemUserRepository;

    @Autowired
    private DeployedWorkerRepository deployedWorkerRepository;

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final double ADMIN_RADIUS_KM = 20.0; // 20km radius for admin
    private static final double WORKER_NOTIFICATION_RADIUS_KM = 20.0; // 20km radius for worker notifications

    public List<Request> getPendingApprovalRequests(Long adminId) {
        List<Request> requests = requestRepository.findByStatusOrderByCreatedAtDesc(Request.RequestStatus.PENDING_ADMIN_APPROVAL);
        // Only filter by radius if admin is not a super admin
        if (adminId != null && !isSuperAdmin(adminId)) {
            return filterByAdminRadius(requests, adminId);
        }
        return requests;
    }

    public List<Request> getActiveRequests(Long adminId) {
        List<Request.RequestStatus> activeStatuses = Arrays.asList(
                Request.RequestStatus.NOTIFIED,
                Request.RequestStatus.CONFIRMED
        );
        List<Request> requests = requestRepository.findByStatusIn(activeStatuses);
        // Only filter by radius if admin is not a super admin
        if (adminId != null && !isSuperAdmin(adminId)) {
            return filterByAdminRadius(requests, adminId);
        }
        // Sort by created date descending
        return requests.stream()
                .sorted(Comparator.comparing(Request::getCreatedAt).reversed())
                .collect(Collectors.toList());
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
                            (request.getWorkerTypes() != null && request.getWorkerTypes().stream()
                                .anyMatch(lt -> lt.toLowerCase().contains(searchLower))) ||
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
        
        // Filter by admin radius if adminId is provided and not a super admin
        if (adminId != null && !isSuperAdmin(adminId)) {
            allRequests = filterByAdminRadius(allRequests, adminId);
        }
        
        return allRequests;
    }

    @Transactional
    public Request approveRequest(Long requestId) {
        // Force flush to ensure all previous deployments are visible
        // This is critical to see deployed workers from other transactions
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
        for (String workerType : savedRequest.getWorkerTypes()) {
            List<Worker> workers = workerRepository.findAvailableWorkersByWorkerType(workerType);
            allAvailableWorkers.addAll(workers);
        }
        List<Worker> availableWorkers = new ArrayList<>(allAvailableWorkers);

        // Calculate distances and sort
        // CRITICAL: Only include verified workers - unverified workers should NEVER receive notifications
        // CRITICAL: Only include workers within 20km radius of the request location
        final Request finalRequest = savedRequest;
        
        // Validate request location first
        if (finalRequest.getLocation() == null || finalRequest.getLocation().getLatitude() == null || finalRequest.getLocation().getLongitude() == null) {
            logger.error("❌ CRITICAL: Request {} has no valid location (lat/long). Cannot calculate distances. Skipping worker notifications.", 
                    finalRequest.getId());
            savedRequest.setStatus(Request.RequestStatus.ADMIN_APPROVED);
            return requestRepository.save(savedRequest);
        }
        
        double requestLat = finalRequest.getLocation().getLatitude();
        double requestLon = finalRequest.getLocation().getLongitude();
        
        // Validate request coordinates are valid (not 0,0 and within valid ranges)
        if (requestLat == 0.0 && requestLon == 0.0) {
            logger.error("❌ CRITICAL: Request {} has invalid location (0,0). Cannot calculate distances. Skipping worker notifications.", 
                    finalRequest.getId());
            savedRequest.setStatus(Request.RequestStatus.ADMIN_APPROVED);
            return requestRepository.save(savedRequest);
        }
        
        if (Math.abs(requestLat) > 90 || Math.abs(requestLon) > 180) {
            logger.error("❌ CRITICAL: Request {} has invalid coordinates (lat: {}, lon: {}). Cannot calculate distances. Skipping worker notifications.", 
                    finalRequest.getId(), requestLat, requestLon);
            savedRequest.setStatus(Request.RequestStatus.ADMIN_APPROVED);
            return requestRepository.save(savedRequest);
        }
        
        logger.info("📍 Request location: lat={}, lon={}, address={} (Request ID: {})", 
                requestLat, requestLon, 
                finalRequest.getLocation().getAddress() != null ? finalRequest.getLocation().getAddress() : "N/A",
                finalRequest.getId());
        
        List<WorkerDistance> workersWithDistance = availableWorkers.stream()
                .filter(worker -> {
                    // First check: Worker MUST be verified by admin
                    if (worker.getVerified() == null || !worker.getVerified()) {
                        logger.debug("Excluding worker {} (ID: {}, Email: {}) - not verified by admin", 
                                worker.getUser().getName(), worker.getUser().getId(), 
                                worker.getUser().getEmail() != null ? worker.getUser().getEmail() : "N/A");
                        return false;
                    }
                    // Second check: Worker must have location
                    if (worker.getCurrentLocation() == null || worker.getCurrentLocation().getLatitude() == null || worker.getCurrentLocation().getLongitude() == null) {
                        logger.debug("Excluding worker {} (ID: {}) - no valid location (lat/long)", 
                                worker.getUser().getName(), worker.getUser().getId());
                        return false;
                    }
                    return true;
                })
                .map(worker -> {
                    double workerLat = worker.getCurrentLocation().getLatitude();
                    double workerLon = worker.getCurrentLocation().getLongitude();
                    
                    // Validate coordinates are valid (not 0,0 which is in the ocean)
                    if (workerLat == 0.0 && workerLon == 0.0) {
                        logger.warn("⚠️ Worker {} (ID: {}) has invalid location (0,0) - excluding from notifications", 
                                worker.getUser().getName(), worker.getUser().getId());
                        return new WorkerDistance(worker, Double.MAX_VALUE); // Set to max to exclude
                    }
                    
                    // Validate coordinates are within valid ranges
                    if (Math.abs(workerLat) > 90 || Math.abs(workerLon) > 180) {
                        logger.warn("⚠️ Worker {} (ID: {}) has invalid coordinates (lat: {}, lon: {}) - excluding from notifications", 
                                worker.getUser().getName(), worker.getUser().getId(), workerLat, workerLon);
                        return new WorkerDistance(worker, Double.MAX_VALUE); // Set to max to exclude
                    }
                    
                    double distance = calculateDistance(requestLat, requestLon, workerLat, workerLon);
                    
                    // Validate distance calculation result
                    if (Double.isNaN(distance) || Double.isInfinite(distance)) {
                        logger.error("❌ Invalid distance calculation for worker {} (ID: {}) - result: {} - excluding from notifications", 
                                worker.getUser().getName(), worker.getUser().getId(), distance);
                        return new WorkerDistance(worker, Double.MAX_VALUE); // Set to max to exclude
                    }
                    
                    logger.info("📍 Worker {} (ID: {}) distance: {} km from request location (lat: {}, lon: {})", 
                            worker.getUser().getName(), worker.getUser().getId(), String.format("%.2f", distance),
                            workerLat, workerLon);
                    return new WorkerDistance(worker, distance);
                })
                .filter(wd -> {
                    // CRITICAL: Only include workers within 20km radius
                    // Also exclude workers with invalid distances (NaN, Infinite, or MAX_VALUE)
                    if (Double.isNaN(wd.getDistance()) || Double.isInfinite(wd.getDistance()) || wd.getDistance() == Double.MAX_VALUE) {
                        logger.warn("🚫 Excluding worker {} (ID: {}) - invalid distance value", 
                                wd.getWorker().getUser().getName(), 
                                wd.getWorker().getUser().getId());
                        return false;
                    }
                    
                    boolean withinRadius = wd.getDistance() <= WORKER_NOTIFICATION_RADIUS_KM;
                    if (!withinRadius) {
                        logger.info("🚫 Excluding worker {} (ID: {}) - distance {} km exceeds {} km radius", 
                                wd.getWorker().getUser().getName(), 
                                wd.getWorker().getUser().getId(),
                                String.format("%.2f", wd.getDistance()),
                                WORKER_NOTIFICATION_RADIUS_KM);
                    } else {
                        logger.info("✅ Worker {} (ID: {}) is within {} km radius - distance: {} km", 
                                wd.getWorker().getUser().getName(), 
                                wd.getWorker().getUser().getId(),
                                WORKER_NOTIFICATION_RADIUS_KM,
                                String.format("%.2f", wd.getDistance()));
                    }
                    return withinRadius;
                })
                .sorted(Comparator.comparing(WorkerDistance::getDistance))
                .limit(finalRequest.getNumberOfWorkers() * 3) // Notify 3x the required workers
                .collect(Collectors.toList());

        logger.info("📍 WORKER NOTIFICATION RADIUS FILTER: Found {} workers within {} km radius of request location (Request ID: {})", 
                workersWithDistance.size(), WORKER_NOTIFICATION_RADIUS_KM, finalRequest.getId());

        // Send notifications via WebSocket to workers who match the required labor types
        // Only notify workers whose labor types match the request requirements
        Map<String, Object> notificationData = new HashMap<>();
        notificationData.put("requestId", finalRequest.getId());
        notificationData.put("workerTypes", finalRequest.getWorkerTypes());
        
        // Include labor type requirements with worker counts
        if (finalRequest.getWorkerTypeRequirements() != null && !finalRequest.getWorkerTypeRequirements().isEmpty()) {
            List<Map<String, Object>> workerTypeReqs = finalRequest.getWorkerTypeRequirements().stream()
                    .map(req -> {
                        Map<String, Object> reqData = new HashMap<>();
                        reqData.put("workerType", req.getWorkerType());
                        reqData.put("numberOfWorkers", req.getNumberOfWorkers());
                        return reqData;
                    })
                    .collect(Collectors.toList());
            notificationData.put("workerTypeRequirements", workerTypeReqs);
        }
        
        notificationData.put("workType", finalRequest.getWorkType());
        notificationData.put("numberOfWorkers", finalRequest.getNumberOfWorkers());
        notificationData.put("startDate", finalRequest.getStartDate() != null ? finalRequest.getStartDate().toString() : null);
        notificationData.put("endDate", finalRequest.getEndDate() != null ? finalRequest.getEndDate().toString() : null);
        notificationData.put("location", finalRequest.getLocation());
        notificationData.put("customerId", finalRequest.getCustomer().getId());
        notificationData.put("customerName", finalRequest.getCustomer().getName());
        notificationData.put("message", "New work request available in your area!");

        // Get list of workers who are already deployed during this request's date range
        // This includes both deployed workers and confirmed workers (who are committed to work)
        List<User> deployedWorkers = deployedWorkerRepository.findWorkersDeployedInDateRange(
                finalRequest.getStartDate(),
                finalRequest.getEndDate()
        );
        Set<Long> deployedWorkerIds = deployedWorkers.stream()
                .map(User::getId)
                .collect(Collectors.toSet());
        
        // Also check for workers who have confirmed requests (even if not yet deployed)
        // These workers are committed to their confirmed work period and shouldn't get new notifications
        List<ConfirmedWorker> confirmedWorkersInRange = confirmedWorkerRepository.findByRequestDateRange(
                finalRequest.getStartDate(),
                finalRequest.getEndDate()
        );
        Set<Long> confirmedWorkerIds = confirmedWorkersInRange.stream()
                .map(cw -> cw.getWorker().getId())
                .collect(Collectors.toSet());
        
        // Combine both sets - workers who are either deployed or confirmed
        Set<Long> allCommittedWorkerIds = new HashSet<>(deployedWorkerIds);
        allCommittedWorkerIds.addAll(confirmedWorkerIds);
        
        logger.info("Checking for committed workers during {} to {}", 
                finalRequest.getStartDate(), finalRequest.getEndDate());
        logger.info("Found {} deployed workers and {} confirmed workers (total {} committed workers)", 
                deployedWorkerIds.size(), confirmedWorkerIds.size(), allCommittedWorkerIds.size());
        
        // Log specific worker IDs for debugging
        logger.info("=== DEPLOYMENT CHECK FOR REQUEST {} (dates: {} to {}) ===", 
                finalRequest.getId(), finalRequest.getStartDate(), finalRequest.getEndDate());
        if (!deployedWorkerIds.isEmpty()) {
            logger.info("Deployed worker IDs from bulk query: {}", deployedWorkerIds);
        } else {
            logger.info("No deployed workers found in bulk query");
        }
        if (!confirmedWorkerIds.isEmpty()) {
            logger.info("Confirmed worker IDs from bulk query: {}", confirmedWorkerIds);
        } else {
            logger.info("No confirmed workers found in bulk query");
        }
        logger.info("Total committed worker IDs: {}", allCommittedWorkerIds);

        // Notify only workers whose labor types match the request AND are not already deployed AND are verified AND not blocked
        int notifiedCount = 0;
        int skippedDeployedCount = 0;
        int skippedUnverifiedCount = 0;
        int skippedBlockedCount = 0;
        for (WorkerDistance wd : workersWithDistance) {
            Worker worker = wd.getWorker();
            Long workerUserId = worker.getUser().getId();
            String workerEmail = worker.getUser().getEmail();
            
            logger.info("🔍 Checking worker {} (ID: {}, Email: {}) for notification eligibility", 
                    worker.getUser().getName(), workerUserId, workerEmail);
            
            // CRITICAL: Skip if worker is not verified (admin must verify account first)
            // Workers MUST be verified by admin before receiving ANY notifications
            if (worker.getVerified() == null || !worker.getVerified()) {
                skippedUnverifiedCount++;
                logger.warn("🚫 BLOCKING NOTIFICATION to worker {} (ID: {}, Email: {}) - account NOT verified by admin. " +
                        "Admin must verify worker profile before they can receive notifications.", 
                        worker.getUser().getName(), workerUserId, workerEmail);
                continue;
            }
            
            // CRITICAL: Skip if worker is not available
            // Workers who are deployed or unavailable should not receive notifications
            if (worker.getAvailable() == null || !worker.getAvailable()) {
                skippedBlockedCount++;
                logger.warn("🚫 BLOCKING NOTIFICATION to worker {} (ID: {}, Email: {}) - worker is unavailable. " +
                        "Worker must be available to receive notifications.", 
                        worker.getUser().getName(), workerUserId, workerEmail);
                continue;
            }
            
            // Skip if worker is blocked
            if (worker.getUser().getBlocked() != null && worker.getUser().getBlocked()) {
                skippedBlockedCount++;
                logger.info("Skipping worker {} (ID: {}) - account is blocked", 
                        worker.getUser().getName(), workerUserId);
                continue;
            }
            
            // CRITICAL: Double-check if worker is deployed using MULTIPLE methods
            // Method 1: Direct native query check (bypasses lazy loading)
            Integer nativeCheckResult = deployedWorkerRepository.hasActiveDeployment(workerUserId);
            boolean hasActiveDeploymentNative = nativeCheckResult != null && nativeCheckResult > 0;
            logger.info("Worker {} (ID: {}, Email: {}) - Native query check for active deployment: {} (result: {})", 
                    worker.getUser().getName(), workerUserId, workerEmail, hasActiveDeploymentNative, nativeCheckResult);
            
            if (hasActiveDeploymentNative) {
                List<Object[]> activeDeployments = deployedWorkerRepository.findActiveDeploymentsForWorker(workerUserId);
                logger.error("🔴 NATIVE QUERY FOUND ACTIVE DEPLOYMENTS for worker {} (Email: {}): {} deployment(s)", 
                        worker.getUser().getName(), workerEmail, activeDeployments.size());
                for (Object[] deployment : activeDeployments) {
                    Long depRequestId = ((Number) deployment[0]).longValue();
                    String status = (String) deployment[1];
                    java.sql.Date startDate = (java.sql.Date) deployment[2];
                    java.sql.Date endDate = (java.sql.Date) deployment[3];
                    logger.error("🔴 Active Deployment: Request ID={}, Status={}, Dates={} to {}", 
                            depRequestId, status, startDate, endDate);
                }
            }
            
            // Method 2: Query using JPA (with eager fetch)
            List<DeployedWorker> workerDeployments = deployedWorkerRepository.findByWorkerOrderByDeployedAtDesc(worker.getUser());
            boolean isCurrentlyDeployed = false;
            Request deployedRequest = null;
            
            logger.info("Worker {} (ID: {}, Email: {}) has {} deployment record(s) from JPA query", 
                    worker.getUser().getName(), workerUserId, workerEmail, workerDeployments.size());
            
            for (DeployedWorker dw : workerDeployments) {
                Request req = dw.getRequest();
                if (req == null) {
                    logger.error("❌ DeployedWorker {} has null request! This should not happen!", dw.getId());
                    continue;
                }
                
                logger.info("Checking deployment: Request ID={}, Status={}, Dates={} to {}, EndDate >= Today: {}", 
                        req.getId(), req.getStatus(), req.getStartDate(), req.getEndDate(),
                        req.getEndDate().isAfter(java.time.LocalDate.now()) || req.getEndDate().isEqual(java.time.LocalDate.now()));
                
                // Check if work period hasn't ended (regardless of date overlap)
                boolean workPeriodActive = req.getEndDate().isAfter(java.time.LocalDate.now()) 
                        || req.getEndDate().isEqual(java.time.LocalDate.now());
                
                // Check if request is not completed
                boolean notCompleted = req.getStatus() != Request.RequestStatus.COMPLETED;
                
                logger.info("Deployment check for Request {}: workPeriodActive={}, notCompleted={}", 
                        req.getId(), workPeriodActive, notCompleted);
                
                if (workPeriodActive && notCompleted) {
                    // Worker has an active deployment - EXCLUDE THEM FROM ALL NEW NOTIFICATIONS
                    // Regardless of date overlap, if worker is deployed and work period hasn't ended, they shouldn't get new notifications
                    isCurrentlyDeployed = true;
                    deployedRequest = req;
                    logger.error("🚨🚨🚨 Worker {} (ID: {}, Email: {}) is ACTIVE deployed in request {} (status: {}, dates: {} to {}). " +
                            "Work period hasn't ended yet. EXCLUDING FROM ALL NEW NOTIFICATIONS 🚨🚨🚨", 
                            worker.getUser().getName(), workerUserId, workerEmail, req.getId(), 
                            req.getStatus(), req.getStartDate(), req.getEndDate());
                    
                    // Special logging for problematic worker
                    if (workerEmail != null && workerEmail.toLowerCase().contains("elctician")) {
                        logger.error("🔴🔴🔴 CRITICAL: Worker {} (Email: {}) SHOULD BE EXCLUDED - Deployment found: Request {}, Status: {}, EndDate: {}", 
                                worker.getUser().getName(), workerEmail, req.getId(), req.getStatus(), req.getEndDate());
                    }
                    break; // Found active deployment, no need to check further
                } else {
                    logger.info("Worker {} (ID: {}, Email: {}) deployment in request {} is not active (workPeriodActive={}, notCompleted={})", 
                            worker.getUser().getName(), workerUserId, workerEmail, req.getId(), workPeriodActive, notCompleted);
                }
            }
            
            // Also check confirmed workers directly
            List<ConfirmedWorker> workerConfirmations = confirmedWorkerRepository.findByWorkerOrderByConfirmedAtDesc(worker.getUser());
            boolean isCurrentlyConfirmed = false;
            Request confirmedRequest = null;
            
            for (ConfirmedWorker cw : workerConfirmations) {
                Request req = cw.getRequest();
                if (req == null) {
                    logger.warn("ConfirmedWorker {} has null request!", cw.getId());
                    continue;
                }
                
                // Check if work period hasn't ended (regardless of date overlap)
                boolean workPeriodActive = req.getEndDate().isAfter(java.time.LocalDate.now()) 
                        || req.getEndDate().isEqual(java.time.LocalDate.now());
                
                // Check if request is not completed
                boolean notCompleted = req.getStatus() != Request.RequestStatus.COMPLETED;
                
                if (workPeriodActive && notCompleted) {
                    // Worker has an active confirmation - EXCLUDE THEM FROM ALL NEW NOTIFICATIONS
                    // Regardless of date overlap, if worker confirmed and work period hasn't ended, they shouldn't get new notifications
                    isCurrentlyConfirmed = true;
                    confirmedRequest = req;
                    logger.warn("⚠️ Worker {} (ID: {}) is ACTIVE confirmed in request {} (status: {}, dates: {} to {}). " +
                            "Work period hasn't ended yet. EXCLUDING FROM ALL NEW NOTIFICATIONS", 
                            worker.getUser().getName(), workerUserId, req.getId(), 
                            req.getStatus(), req.getStartDate(), req.getEndDate());
                    break; // Found active confirmation, no need to check further
                }
            }
            
            // Skip if worker is already deployed or confirmed during this period (work period hasn't ended)
            // Workers can receive notifications after their work period ends or after work is marked as COMPLETED
            // CRITICAL: Also check native query result - if native query says worker is deployed, block them
            if (hasActiveDeploymentNative || isCurrentlyDeployed || isCurrentlyConfirmed || allCommittedWorkerIds.contains(workerUserId)) {
                skippedDeployedCount++;
                String reason = "";
                if (hasActiveDeploymentNative) {
                    reason = "NATIVE QUERY detected active deployment";
                } else if (isCurrentlyDeployed && deployedRequest != null) {
                    reason = String.format("deployed in request %d (dates: %s to %s)", 
                            deployedRequest.getId(), deployedRequest.getStartDate(), deployedRequest.getEndDate());
                } else if (isCurrentlyConfirmed && confirmedRequest != null) {
                    reason = String.format("confirmed in request %d (dates: %s to %s)", 
                            confirmedRequest.getId(), confirmedRequest.getStartDate(), confirmedRequest.getEndDate());
                } else if (allCommittedWorkerIds.contains(workerUserId)) {
                    reason = "found in committed workers set";
                }
                
                logger.error("🚫 BLOCKING NOTIFICATION to worker {} (ID: {}, Email: {}) - {}. " +
                        "Checks: native={}, jpa deployed={}, confirmed={}, in committed set={}. " +
                        "New request: {} (dates: {} to {})", 
                        worker.getUser().getName(), workerUserId, workerEmail, reason,
                        hasActiveDeploymentNative, isCurrentlyDeployed, isCurrentlyConfirmed, allCommittedWorkerIds.contains(workerUserId),
                        finalRequest.getId(), finalRequest.getStartDate(), finalRequest.getEndDate());
                
                // Special check for problematic worker
                if (workerEmail != null && workerEmail.toLowerCase().contains("elctician")) {
                    logger.error("🔴🔴🔴 CRITICAL: Worker {} (Email: {}) WAS BLOCKED - should NOT receive notification!", 
                            worker.getUser().getName(), workerEmail);
                }
                continue;
            }
            
            // Check if worker has at least one matching labor type
            boolean hasMatchingWorkerType = finalRequest.getWorkerTypes().stream()
                    .anyMatch(workerType -> worker.getWorkerTypes().contains(workerType));
            
            if (hasMatchingWorkerType) {
                // CRITICAL: Final safety checks before sending notification
                // 1. Verify worker is still verified (double-check)
                if (worker.getVerified() == null || !worker.getVerified()) {
                    skippedUnverifiedCount++;
                    logger.error("🚫 FINAL VERIFICATION CHECK: Worker {} (Email: {}) is NOT verified - BLOCKING NOTIFICATION!", 
                            worker.getUser().getName(), workerEmail);
                    continue; // Skip to next worker - DO NOT SEND NOTIFICATION
                }
                
                // 2. Verify worker is still available (double-check)
                if (worker.getAvailable() == null || !worker.getAvailable()) {
                    skippedBlockedCount++;
                    logger.error("🚫 FINAL AVAILABILITY CHECK: Worker {} (Email: {}) is NOT available - BLOCKING NOTIFICATION!", 
                            worker.getUser().getName(), workerEmail);
                    continue; // Skip to next worker - DO NOT SEND NOTIFICATION
                }
                
                // 3. Check if worker is deployed (final check using native query - most reliable)
                Integer finalNativeCheckResult = deployedWorkerRepository.hasActiveDeployment(workerUserId);
                boolean finalNativeCheck = finalNativeCheckResult != null && finalNativeCheckResult > 0;
                if (finalNativeCheck) {
                    skippedDeployedCount++;
                    logger.error("🚫🚫🚫 FINAL NATIVE QUERY BLOCK: Worker {} (Email: {}) has active deployment - NOTIFICATION BLOCKED!", 
                            worker.getUser().getName(), workerEmail);
                    continue; // Skip to next worker - DO NOT SEND NOTIFICATION
                }
                
                // 4. Also check using JPA (backup check)
                List<DeployedWorker> finalDeploymentCheck = deployedWorkerRepository.findByWorkerOrderByDeployedAtDesc(worker.getUser());
                boolean hasActiveDeployment = false;
                for (DeployedWorker dw : finalDeploymentCheck) {
                    Request r = dw.getRequest();
                    if (r != null) {
                        boolean active = (r.getEndDate().isAfter(java.time.LocalDate.now()) || r.getEndDate().isEqual(java.time.LocalDate.now()))
                                && r.getStatus() != Request.RequestStatus.COMPLETED;
                        if (active) {
                            hasActiveDeployment = true;
                            logger.error("🔴 FINAL JPA CHECK: Worker {} (Email: {}) has active deployment in request {} - BLOCKING NOTIFICATION!", 
                                    worker.getUser().getName(), workerEmail, r.getId());
                            break;
                        }
                    }
                }
                
                if (hasActiveDeployment) {
                    skippedDeployedCount++;
                    logger.error("🚫🚫🚫 FINAL JPA BLOCK: Worker {} (Email: {}) has active deployment - NOTIFICATION BLOCKED!", 
                            worker.getUser().getName(), workerEmail);
                    continue; // Skip to next worker - DO NOT SEND NOTIFICATION
                }
                
                // CRITICAL: Final distance check before sending notification
                // Double-check that worker is within 20km radius
                double finalDistance = wd.getDistance();
                
                // Validate distance is valid
                if (Double.isNaN(finalDistance) || Double.isInfinite(finalDistance) || finalDistance == Double.MAX_VALUE) {
                    logger.error("🚫🚫🚫 INVALID DISTANCE: Worker {} (ID: {}, Email: {}) has invalid distance value: {} - NOTIFICATION BLOCKED!", 
                            worker.getUser().getName(), worker.getUser().getId(), workerEmail, finalDistance);
                    continue; // Skip to next worker - DO NOT SEND NOTIFICATION
                }
                
                if (finalDistance > WORKER_NOTIFICATION_RADIUS_KM) {
                    logger.error("🚫🚫🚫 DISTANCE CHECK FAILED: Worker {} (ID: {}, Email: {}) is {} km away (exceeds {} km limit) - NOTIFICATION BLOCKED!", 
                            worker.getUser().getName(), worker.getUser().getId(), workerEmail, 
                            String.format("%.2f", finalDistance), WORKER_NOTIFICATION_RADIUS_KM);
                    continue; // Skip to next worker - DO NOT SEND NOTIFICATION
                }
                
                // Additional validation: Ensure distance is not negative (shouldn't happen, but safety check)
                if (finalDistance < 0) {
                    logger.error("🚫🚫🚫 NEGATIVE DISTANCE: Worker {} (ID: {}, Email: {}) has negative distance: {} - NOTIFICATION BLOCKED!", 
                            worker.getUser().getName(), worker.getUser().getId(), workerEmail, finalDistance);
                    continue; // Skip to next worker - DO NOT SEND NOTIFICATION
                }
                
                // Final safety check - log before sending notification
                logger.info("✅ SENDING NOTIFICATION to worker {} (ID: {}, Email: {}) for request {} (dates: {} to {}). Distance: {} km (within {} km limit)", 
                        worker.getUser().getName(), worker.getUser().getId(), workerEmail, finalRequest.getId(),
                        finalRequest.getStartDate(), finalRequest.getEndDate(), 
                        String.format("%.2f", finalDistance), WORKER_NOTIFICATION_RADIUS_KM);
                
                messagingTemplate.convertAndSend(
                        "/topic/worker/" + worker.getUser().getId(),
                        notificationData
                );
                notifiedCount++;
                logger.info("✓✓✓ NOTIFIED worker: {} (ID: {}, Email: {}) for request: {} at distance: {} km", 
                        worker.getUser().getName(), worker.getUser().getId(), workerEmail, finalRequest.getId(),
                        String.format("%.2f", finalDistance));
                
                // Special logging for problematic worker
                if (workerEmail != null && workerEmail.toLowerCase().contains("elctician")) {
                    logger.error("🔴🔴🔴 WARNING: Worker {} (Email: {}) WAS NOTIFIED - This should not happen if deployed!", 
                            worker.getUser().getName(), workerEmail);
                }
            }
        }
        
        logger.info("Total workers notified: {} (skipped {} deployed workers, {} unverified workers, {} blocked workers) out of {} available workers", 
                notifiedCount, skippedDeployedCount, skippedUnverifiedCount, skippedBlockedCount, workersWithDistance.size());

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

    // Helper method removed - now using String for labor types in Request

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
    public Object createUser(Long creatingAdminId, String name, String email, String phone, String secondaryPhone, String password, User.UserRole role, LocationDto location, List<String> workerTypes, Boolean isSuperAdmin) {
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
        if (role == User.UserRole.WORKER && workerTypes != null && !workerTypes.isEmpty()) {
            Worker worker = new Worker();
            worker.setUser(user);
            worker.setWorkerTypes(workerTypes);
            // New workers are not verified by default, so set them as unavailable
            worker.setVerified(false);
            worker.setAvailable(false);
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

    public List<Map<String, Object>> getAllWorkers(Long adminId, String search, String sortBy, String sortOrder, Boolean locationFilter) {
        List<Worker> workers = workerRepository.findAll();
        
        // Filter by admin radius if adminId is provided
        if (adminId != null) {
            boolean isSuper = isSuperAdmin(adminId);
            logger.debug("getAllWorkers - adminId: {}, isSuperAdmin: {}, locationFilter: {}", adminId, isSuper, locationFilter);
            
            if (!isSuper) {
                // Non-super admin: ALWAYS filter by radius (20km)
                logger.debug("Non-super admin detected, filtering workers by 20km radius");
                workers = filterWorkersByAdminRadius(workers, adminId);
            } else if (locationFilter != null && locationFilter) {
                // Super admin: filter by location only if locationFilter is explicitly true
                logger.debug("Super admin with locationFilter=true, filtering workers by 20km radius");
                workers = filterWorkersByAdminRadius(workers, adminId);
            } else {
                // Super admin without locationFilter: return all workers
                logger.debug("Super admin without locationFilter, returning all workers");
            }
        } else {
            logger.warn("getAllWorkers called with null adminId - returning all workers (this should not happen)");
        }
        
        // Apply search filter
        if (search != null && !search.trim().isEmpty()) {
            String searchLower = search.toLowerCase().trim();
            workers = workers.stream()
                    .filter(worker -> {
                        String name = worker.getUser().getName() != null ? worker.getUser().getName().toLowerCase() : "";
                        String email = worker.getUser().getEmail() != null ? worker.getUser().getEmail().toLowerCase() : "";
                        String phone = worker.getUser().getPhone() != null ? worker.getUser().getPhone() : "";
                        String address = worker.getCurrentLocation() != null && worker.getCurrentLocation().getAddress() != null 
                                ? worker.getCurrentLocation().getAddress().toLowerCase() : "";
                        String workerTypes = worker.getWorkerTypes() != null 
                                ? worker.getWorkerTypes().stream()
                                        .map(String::toLowerCase)
                                        .collect(Collectors.joining(" "))
                                : "";
                        return name.contains(searchLower) || email.contains(searchLower) || 
                               phone.contains(searchLower) || address.contains(searchLower) ||
                               workerTypes.contains(searchLower);
                    })
                    .collect(Collectors.toList());
        }
        
        // Apply sorting
        Comparator<Worker> comparator = null;
        if (sortBy != null) {
            switch (sortBy.toLowerCase()) {
                case "name":
                    comparator = Comparator.comparing(w -> w.getUser().getName() != null ? w.getUser().getName() : "");
                    break;
                case "rating":
                    comparator = Comparator.comparing(w -> w.getRating() != null ? w.getRating() : 0.0);
                    break;
                case "totaljobs":
                    comparator = Comparator.comparing(w -> w.getTotalJobs() != null ? w.getTotalJobs() : 0);
                    break;
                case "createdat":
                case "date":
                default:
                    comparator = Comparator.comparing(w -> w.getCreatedAt() != null ? w.getCreatedAt() : java.time.LocalDateTime.MIN);
                    break;
            }
        } else {
            comparator = Comparator.comparing(w -> w.getCreatedAt() != null ? w.getCreatedAt() : java.time.LocalDateTime.MIN);
        }
        
        if (comparator != null) {
            if (sortOrder != null && sortOrder.equalsIgnoreCase("asc")) {
                workers = workers.stream().sorted(comparator).collect(Collectors.toList());
            } else {
                workers = workers.stream().sorted(comparator.reversed()).collect(Collectors.toList());
            }
        }
        
        return workers.stream().map(worker -> {
            Map<String, Object> workerData = new HashMap<>();
            workerData.put("id", worker.getId());
            workerData.put("userId", worker.getUser().getId());
            workerData.put("name", worker.getUser().getName());
            workerData.put("email", worker.getUser().getEmail());
            workerData.put("phone", worker.getUser().getPhone());
            workerData.put("secondaryPhone", worker.getUser().getSecondaryPhone());
            workerData.put("workerTypes", worker.getWorkerTypes());
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

    public List<Map<String, Object>> getAllCustomers(Long adminId, String search, String sortBy, String sortOrder, Boolean locationFilter) {
        List<User> customers = userRepository.findAll().stream()
                .filter(user -> user.getRole() == User.UserRole.CUSTOMER)
                .collect(Collectors.toList());
        
        // Filter by admin radius if adminId is provided
        if (adminId != null) {
            boolean isSuper = isSuperAdmin(adminId);
            logger.debug("getAllCustomers - adminId: {}, isSuperAdmin: {}, locationFilter: {}", adminId, isSuper, locationFilter);
            
            if (!isSuper) {
                // Non-super admin: ALWAYS filter by radius (20km)
                logger.debug("Non-super admin detected, filtering customers by 20km radius");
                customers = filterCustomersByAdminRadius(customers, adminId);
            } else if (locationFilter != null && locationFilter) {
                // Super admin: filter by location only if locationFilter is explicitly true
                logger.debug("Super admin with locationFilter=true, filtering customers by 20km radius");
                customers = filterCustomersByAdminRadius(customers, adminId);
            } else {
                // Super admin without locationFilter: return all customers
                logger.debug("Super admin without locationFilter, returning all customers");
            }
        } else {
            logger.warn("getAllCustomers called with null adminId - returning all customers (this should not happen)");
        }
        
        // Apply search filter
        if (search != null && !search.trim().isEmpty()) {
            String searchLower = search.toLowerCase().trim();
            customers = customers.stream()
                    .filter(customer -> {
                        String name = customer.getName() != null ? customer.getName().toLowerCase() : "";
                        String email = customer.getEmail() != null ? customer.getEmail().toLowerCase() : "";
                        String phone = customer.getPhone() != null ? customer.getPhone() : "";
                        String address = customer.getLocation() != null && customer.getLocation().getAddress() != null 
                                ? customer.getLocation().getAddress().toLowerCase() : "";
                        return name.contains(searchLower) || email.contains(searchLower) || 
                               phone.contains(searchLower) || address.contains(searchLower);
                    })
                    .collect(Collectors.toList());
        }
        
        // Apply sorting
        Comparator<User> comparator = null;
        if (sortBy != null) {
            switch (sortBy.toLowerCase()) {
                case "name":
                    comparator = Comparator.comparing(u -> u.getName() != null ? u.getName() : "");
                    break;
                case "createdat":
                case "date":
                default:
                    comparator = Comparator.comparing(u -> u.getCreatedAt() != null ? u.getCreatedAt() : java.time.LocalDateTime.MIN);
                    break;
            }
        } else {
            comparator = Comparator.comparing(u -> u.getCreatedAt() != null ? u.getCreatedAt() : java.time.LocalDateTime.MIN);
        }
        
        if (comparator != null) {
            if (sortOrder != null && sortOrder.equalsIgnoreCase("asc")) {
                customers = customers.stream().sorted(comparator).collect(Collectors.toList());
            } else {
                customers = customers.stream().sorted(comparator.reversed()).collect(Collectors.toList());
            }
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
        
        boolean newVerifiedStatus = worker.getVerified() == null || !worker.getVerified();
        worker.setVerified(newVerifiedStatus);
        
        // If worker is verified, set them as available (if not already set)
        // If worker is not verified, set them as unavailable
        if (newVerifiedStatus) {
            // Worker is now verified - make them available
            worker.setAvailable(true);
            logger.info("Worker {} (ID: {}) verified and set to available", 
                    worker.getUser().getName(), workerId);
        } else {
            // Worker is now unverified - make them unavailable
            worker.setAvailable(false);
            logger.info("Worker {} (ID: {}) unverified and set to unavailable", 
                    worker.getUser().getName(), workerId);
        }
        
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
        
        // If admin has no location, return all requests
        if (adminLocation == null || adminLocation.getLatitude() == null || adminLocation.getLongitude() == null) {
            return requests;
        }
        
        double adminLat = adminLocation.getLatitude();
        double adminLon = adminLocation.getLongitude();
        
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
        
        // If admin has no location, return empty list (can't filter without location)
        if (adminLocation == null || adminLocation.getLatitude() == null || adminLocation.getLongitude() == null) {
            logger.warn("Admin {} has no location, returning empty worker list", adminId);
            return new ArrayList<>();
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
        
        // If admin has no location, return empty list (can't filter without location)
        if (adminLocation == null || adminLocation.getLatitude() == null || adminLocation.getLongitude() == null) {
            logger.warn("Admin {} has no location, returning empty customer list", adminId);
            return new ArrayList<>();
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
    public boolean isSuperAdmin(Long adminId) {
        if (adminId == null) {
            logger.warn("isSuperAdmin: adminId is null");
            return false;
        }
        
        logger.debug("isSuperAdmin check for adminId: {}", adminId);
        
        // Check if it's a system user (negative ID) or regular user
        if (adminId < 0) {
            // System user - use absolute value to get the actual ID
            Long systemUserId = Math.abs(adminId);
            logger.debug("Checking system user with ID: {}", systemUserId);
            java.util.Optional<SystemUser> systemUserOpt = systemUserRepository.findById(systemUserId);
            if (systemUserOpt.isPresent()) {
                SystemUser systemUser = systemUserOpt.get();
                boolean isSuper = systemUser.getSuperAdmin() != null && systemUser.getSuperAdmin();
                logger.debug("System user found. SuperAdmin: {}", isSuper);
                return isSuper;
            } else {
                logger.warn("System user not found with ID: {}", systemUserId);
                return false;
            }
        } else {
            // Regular user (legacy admin) - should not happen for system users, but handle it
            logger.debug("Checking regular user with ID: {}", adminId);
            java.util.Optional<User> userOpt = userRepository.findById(adminId);
            if (userOpt.isPresent()) {
                User admin = userOpt.get();
                boolean isSuper = admin.getSuperAdmin() != null && admin.getSuperAdmin();
                logger.debug("Regular user found. SuperAdmin: {}", isSuper);
                return isSuper;
            } else {
                logger.warn("Regular user not found with ID: {}", adminId);
                return false;
            }
        }
    }

    public List<Map<String, Object>> getAllSystemUsers(Long adminId, String search, String sortBy, String sortOrder, Boolean locationFilter) {
        logger.debug("getAllSystemUsers called with adminId: {} (type: {})", 
                adminId, adminId != null ? adminId.getClass().getName() : "null");
        
        // Only super admin can see all system users
        try {
            boolean isSuper = isSuperAdmin(adminId);
            logger.debug("Is super admin: {}", isSuper);
            if (!isSuper) {
                logger.warn("User is not a super admin. AdminId: {}", adminId);
                throw new RuntimeException("Only super admin can view system users");
            }
        } catch (Exception e) {
            logger.error("Error checking super admin status: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to verify super admin status: " + e.getMessage(), e);
        }

        List<SystemUser> systemUsers = systemUserRepository.findAll();
        logger.debug("Found {} system users", systemUsers.size());
        
        // Filter by admin radius if locationFilter is true
        if (locationFilter != null && locationFilter && adminId != null) {
            systemUsers = filterSystemUsersByAdminRadius(systemUsers, adminId);
        }
        
        // Apply search filter
        if (search != null && !search.trim().isEmpty()) {
            String searchLower = search.toLowerCase().trim();
            systemUsers = systemUsers.stream()
                    .filter(systemUser -> {
                        String name = systemUser.getName() != null ? systemUser.getName().toLowerCase() : "";
                        String email = systemUser.getEmail() != null ? systemUser.getEmail().toLowerCase() : "";
                        String phone = systemUser.getPhone() != null ? systemUser.getPhone() : "";
                        String address = systemUser.getLocation() != null && systemUser.getLocation().getAddress() != null 
                                ? systemUser.getLocation().getAddress().toLowerCase() : "";
                        return name.contains(searchLower) || email.contains(searchLower) || 
                               phone.contains(searchLower) || address.contains(searchLower);
                    })
                    .collect(Collectors.toList());
        }
        
        // Apply sorting
        Comparator<SystemUser> comparator = null;
        if (sortBy != null) {
            switch (sortBy.toLowerCase()) {
                case "name":
                    comparator = Comparator.comparing(u -> u.getName() != null ? u.getName() : "");
                    break;
                case "createdat":
                case "date":
                default:
                    comparator = Comparator.comparing(u -> u.getCreatedAt() != null ? u.getCreatedAt() : java.time.LocalDateTime.MIN);
                    break;
            }
        } else {
            comparator = Comparator.comparing(u -> u.getCreatedAt() != null ? u.getCreatedAt() : java.time.LocalDateTime.MIN);
        }
        
        if (comparator != null) {
            if (sortOrder != null && sortOrder.equalsIgnoreCase("asc")) {
                systemUsers = systemUsers.stream().sorted(comparator).collect(Collectors.toList());
            } else {
                systemUsers = systemUsers.stream().sorted(comparator.reversed()).collect(Collectors.toList());
            }
        }
        
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
    
    // Helper method to filter system users by admin radius
    private List<SystemUser> filterSystemUsersByAdminRadius(List<SystemUser> systemUsers, Long adminId) {
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
        
        // If admin has no location, return all system users
        if (adminLocation == null || adminLocation.getLatitude() == null || adminLocation.getLongitude() == null) {
            return systemUsers;
        }
        
        double adminLat = adminLocation.getLatitude();
        double adminLon = adminLocation.getLongitude();
        
        return systemUsers.stream()
                .filter(systemUser -> {
                    if (systemUser.getLocation() == null || systemUser.getLocation().getLatitude() == null || systemUser.getLocation().getLongitude() == null) {
                        return false;
                    }
                    double distance = calculateDistance(
                            adminLat, adminLon,
                            systemUser.getLocation().getLatitude(),
                            systemUser.getLocation().getLongitude()
                    );
                    return distance <= ADMIN_RADIUS_KM;
                })
                .collect(Collectors.toList());
    }

    /**
     * Get confirmation status for a request, grouped by labor type
     * Returns a map with labor type as key and confirmation details as value
     */
    public Map<String, Object> getRequestConfirmationStatus(Long requestId) {
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        // Eagerly load confirmed workers and their worker profiles
        if (request.getConfirmedWorkers() != null) {
            request.getConfirmedWorkers().size(); // Trigger lazy loading
            for (ConfirmedWorker cw : request.getConfirmedWorkers()) {
                if (cw.getWorker() != null) {
                    // Load worker profile to get labor types
                    workerRepository.findByUserId(cw.getWorker().getId()).ifPresent(worker -> {
                        // This ensures worker profile is loaded
                    });
                }
            }
        }

        // Load labor type requirements
        if (request.getWorkerTypeRequirements() != null) {
            request.getWorkerTypeRequirements().size(); // Trigger lazy loading
        }

        Map<String, Object> status = new HashMap<>();
        int totalConfirmed = request.getConfirmedWorkers() != null ? request.getConfirmedWorkers().size() : 0;
        int totalRequired = request.getNumberOfWorkers();
        int totalPending = Math.max(0, totalRequired - totalConfirmed);
        
        status.put("requestId", request.getId());
        status.put("totalConfirmed", totalConfirmed);
        status.put("totalRequired", totalRequired);
        status.put("totalPending", totalPending);

        // Group confirmed workers by labor type
        Map<String, List<Map<String, Object>>> confirmedByWorkerType = new HashMap<>();
        Map<String, Integer> requiredByWorkerType = new HashMap<>();

        // Initialize required counts from labor type requirements
        if (request.getWorkerTypeRequirements() != null) {
            for (RequestWorkerTypeRequirement req : request.getWorkerTypeRequirements()) {
                requiredByWorkerType.put(req.getWorkerType(), req.getNumberOfWorkers());
                confirmedByWorkerType.put(req.getWorkerType(), new ArrayList<>());
            }
        }

        // Group confirmed workers by their labor types
        if (request.getConfirmedWorkers() != null) {
            for (ConfirmedWorker cw : request.getConfirmedWorkers()) {
                User workerUser = cw.getWorker();
                Worker worker = workerRepository.findByUserId(workerUser.getId()).orElse(null);
                
                if (worker != null && worker.getWorkerTypes() != null) {
                    Map<String, Object> workerInfo = new HashMap<>();
                    workerInfo.put("userId", workerUser.getId());
                    workerInfo.put("name", workerUser.getName());
                    workerInfo.put("phone", workerUser.getPhone());
                    workerInfo.put("email", workerUser.getEmail());
                    workerInfo.put("confirmedAt", cw.getConfirmedAt());
                    
                    // Add this worker to all matching labor types
                    for (String workerType : worker.getWorkerTypes()) {
                        if (requiredByWorkerType.containsKey(workerType)) {
                            confirmedByWorkerType.get(workerType).add(workerInfo);
                        }
                    }
                }
            }
        }

        // Build status per labor type
        List<Map<String, Object>> workerTypeStatus = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : requiredByWorkerType.entrySet()) {
            String workerType = entry.getKey();
            Integer required = entry.getValue();
            List<Map<String, Object>> confirmed = confirmedByWorkerType.get(workerType);
            int confirmedCount = confirmed != null ? confirmed.size() : 0;
            
            int pendingCount = Math.max(0, required - confirmedCount);
            
            Map<String, Object> ltStatus = new HashMap<>();
            ltStatus.put("workerType", workerType);
            ltStatus.put("required", required);
            ltStatus.put("confirmed", confirmedCount);
            ltStatus.put("pending", pendingCount);
            ltStatus.put("confirmedWorkers", confirmed != null ? confirmed : new ArrayList<>());
            ltStatus.put("canDeploy", confirmedCount >= required);
            
            workerTypeStatus.add(ltStatus);
        }

        status.put("workerTypeStatus", workerTypeStatus);
        
        // Check if all labor types have enough confirmations
        boolean allRequirementsMet = workerTypeStatus.stream()
                .allMatch(lt -> (Boolean) lt.get("canDeploy"));
        status.put("allRequirementsMet", allRequirementsMet);
        
        // Check if at least one worker has confirmed (for deploy button visibility)
        boolean canDeploy = totalConfirmed > 0;
        status.put("canDeploy", canDeploy);

        return status;
    }

    /**
     * Deploy workers to customer based on labor type requirements
     * Only deploys if all labor type requirements are met
     */
    @Transactional
    public Request deployWorkers(Long requestId) {
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (request.getStatus() != Request.RequestStatus.NOTIFIED && 
            request.getStatus() != Request.RequestStatus.CONFIRMED) {
            throw new RuntimeException("Request must be in NOTIFIED or CONFIRMED status to deploy");
        }

        // Check confirmation status
        Map<String, Object> confirmationStatus = getRequestConfirmationStatus(requestId);
        boolean canDeploy = confirmationStatus.get("canDeploy") != null && (Boolean) confirmationStatus.get("canDeploy");

        if (!canDeploy) {
            throw new RuntimeException("No workers have confirmed yet. Cannot deploy.");
        }

        // Get labor type status
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> workerTypeStatus = (List<Map<String, Object>>) confirmationStatus.get("workerTypeStatus");

        // Clear existing deployed workers (if any)
        if (request.getDeployedWorkers() != null) {
            request.getDeployedWorkers().clear();
        }

        // Deploy workers per labor type requirement
        for (Map<String, Object> ltStatus : workerTypeStatus) {
            Integer required = (Integer) ltStatus.get("required");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> confirmedWorkers = (List<Map<String, Object>>) ltStatus.get("confirmedWorkers");

            // Deploy required number of workers for this labor type
            int deployed = 0;
            for (Map<String, Object> workerInfo : confirmedWorkers) {
                if (deployed >= required) break;

                Long userId = ((Number) workerInfo.get("userId")).longValue();
                User workerUser = userRepository.findById(userId)
                        .orElseThrow(() -> new RuntimeException("Worker not found"));

                // Check if already deployed
                boolean alreadyDeployed = request.getDeployedWorkers().stream()
                        .anyMatch(dw -> dw.getWorker().getId().equals(userId));

                if (!alreadyDeployed) {
                    DeployedWorker deployedWorker = new DeployedWorker();
                    deployedWorker.setRequest(request);
                    deployedWorker.setWorker(workerUser);
                    request.getDeployedWorkers().add(deployedWorker);
                    
                    // Set worker as unavailable when deployed
                    Worker workerProfile = workerRepository.findByUserId(userId).orElse(null);
                    if (workerProfile != null) {
                        workerProfile.setAvailable(false);
                        workerRepository.save(workerProfile);
                        logger.info("Worker {} (ID: {}) set to unavailable after deployment", 
                                workerUser.getName(), userId);
                    }
                    
                    deployed++;
                }
            }
        }

        request.setStatus(Request.RequestStatus.DEPLOYED);
        Request savedRequest = requestRepository.save(request);

        // Notify customer
        Map<String, Object> deploymentData = new HashMap<>();
        deploymentData.put("requestId", savedRequest.getId());
        deploymentData.put("workerTypeRequirements", savedRequest.getWorkerTypeRequirements().stream()
                .map(req -> {
                    Map<String, Object> reqData = new HashMap<>();
                    reqData.put("workerType", req.getWorkerType());
                    reqData.put("numberOfWorkers", req.getNumberOfWorkers());
                    return reqData;
                })
                .collect(Collectors.toList()));
        deploymentData.put("deployedWorkers", savedRequest.getDeployedWorkers().stream()
                .map(dw -> {
                    Map<String, Object> workerData = new HashMap<>();
                    workerData.put("id", dw.getWorker().getId());
                    workerData.put("name", dw.getWorker().getName());
                    workerData.put("phone", dw.getWorker().getPhone());
                    return workerData;
                })
                .collect(Collectors.toList()));
        messagingTemplate.convertAndSend(
                "/topic/customer/" + savedRequest.getCustomer().getId(),
                deploymentData
        );

        return savedRequest;
    }
}


