package com.kaamkart.repository;

import com.kaamkart.model.DeployedWorker;
import com.kaamkart.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface DeployedWorkerRepository extends JpaRepository<DeployedWorker, Long> {
    
    @Query("SELECT dw FROM DeployedWorker dw " +
           "LEFT JOIN FETCH dw.request " +
           "WHERE dw.worker = :worker " +
           "ORDER BY dw.deployedAt DESC")
    List<DeployedWorker> findByWorkerOrderByDeployedAtDesc(@Param("worker") User worker);
    
    /**
     * Find workers who are deployed in requests that overlap with the given date range
     * A request overlaps if its date range intersects with the given date range
     * Only includes deployments where the work period hasn't ended
     * Workers can receive notifications:
     * - After their work period ends (endDate has passed)
     * - After their work is marked as COMPLETED
     * 
     * This query excludes workers who are currently deployed and whose work period hasn't ended yet.
     * Once the work period ends (endDate < CURRENT_DATE) or the request is COMPLETED, 
     * the worker can receive new notifications.
     * 
     * IMPORTANT: We check ALL deployed workers regardless of request status, because once a worker
     * is deployed, they are committed to that work period until it ends or is completed.
     */
    @Query("SELECT DISTINCT dw.worker FROM DeployedWorker dw " +
           "WHERE dw.request.startDate <= :endDate AND dw.request.endDate >= :startDate " +
           "AND dw.request.endDate >= CURRENT_DATE " +
           "AND dw.request.status != 'COMPLETED'")
    List<User> findWorkersDeployedInDateRange(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
    
    /**
     * Direct check: Find if a worker has ANY active deployment (work period hasn't ended)
     * Uses native query to bypass any lazy loading issues
     * Returns true if worker has at least one active deployment
     */
    @Query(value = "SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM deployed_workers dw " +
           "INNER JOIN requests r ON dw.request_id = r.id " +
           "WHERE dw.worker_id = :workerId " +
           "AND r.end_date >= CURRENT_DATE " +
           "AND r.status != 'COMPLETED'", nativeQuery = true)
    Integer hasActiveDeployment(@Param("workerId") Long workerId);
    
    /**
     * Get all active deployments for a worker (direct database check)
     * Returns request IDs where worker is deployed and work period is active
     */
    @Query(value = "SELECT r.id, r.status, r.start_date, r.end_date FROM deployed_workers dw " +
           "INNER JOIN requests r ON dw.request_id = r.id " +
           "WHERE dw.worker_id = :workerId " +
           "AND r.end_date >= CURRENT_DATE " +
           "AND r.status != 'COMPLETED'", nativeQuery = true)
    List<Object[]> findActiveDeploymentsForWorker(@Param("workerId") Long workerId);
}

