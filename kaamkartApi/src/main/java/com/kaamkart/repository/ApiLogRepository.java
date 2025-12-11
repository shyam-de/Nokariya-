package com.kaamkart.repository;

import com.kaamkart.model.ApiLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ApiLogRepository extends JpaRepository<ApiLog, Long> {
    
    Page<ApiLog> findByEndpointContaining(String endpoint, Pageable pageable);
    
    Page<ApiLog> findByStatusCode(Integer statusCode, Pageable pageable);
    
    Page<ApiLog> findByUserId(Long userId, Pageable pageable);
    
    List<ApiLog> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    
    @Query("SELECT COUNT(a) FROM ApiLog a WHERE a.endpoint = :endpoint AND a.statusCode >= 400")
    Long countErrorsByEndpoint(@Param("endpoint") String endpoint);
    
    @Query("SELECT AVG(a.responseTimeMs) FROM ApiLog a WHERE a.endpoint = :endpoint")
    Double getAverageResponseTime(@Param("endpoint") String endpoint);
    
    @Query("SELECT a.endpoint, COUNT(a) as count, AVG(a.responseTimeMs) as avgTime " +
           "FROM ApiLog a WHERE a.createdAt >= :since " +
           "GROUP BY a.endpoint ORDER BY count DESC")
    List<Object[]> getEndpointStats(@Param("since") LocalDateTime since);
}

