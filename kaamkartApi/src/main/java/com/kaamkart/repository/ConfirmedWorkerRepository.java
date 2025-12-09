package com.kaamkart.repository;

import com.kaamkart.model.ConfirmedWorker;
import com.kaamkart.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ConfirmedWorkerRepository extends JpaRepository<ConfirmedWorker, Long> {
    
    @Query("SELECT cw FROM ConfirmedWorker cw " +
           "LEFT JOIN FETCH cw.request " +
           "WHERE cw.worker = :worker " +
           "ORDER BY cw.confirmedAt DESC")
    List<ConfirmedWorker> findByWorkerOrderByConfirmedAtDesc(@Param("worker") User worker);
    
    /**
     * Find workers who have confirmed requests that overlap with the given date range
     * A request overlaps if its date range intersects with the given date range
     * Only includes active requests (not COMPLETED) and where the work period hasn't ended
     * Workers who have confirmed are committed to that work period and shouldn't receive new notifications
     * until their work period ends or work is marked as COMPLETED
     * 
     * IMPORTANT: We check ALL confirmed workers regardless of request status (except COMPLETED),
     * because once a worker confirms, they are committed to that work period until it ends or is completed.
     */
    @Query("SELECT cw FROM ConfirmedWorker cw " +
           "WHERE cw.request.startDate <= :endDate AND cw.request.endDate >= :startDate " +
           "AND cw.request.endDate >= CURRENT_DATE " +
           "AND cw.request.status != 'COMPLETED'")
    List<ConfirmedWorker> findByRequestDateRange(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
}

