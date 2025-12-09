package com.kaamkart.repository;

import com.kaamkart.model.Advertisement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AdvertisementRepository extends JpaRepository<Advertisement, Long> {
    
    @Query("SELECT a FROM Advertisement a WHERE a.isActive = true " +
           "AND (a.startDate IS NULL OR a.startDate <= :now) " +
           "AND (a.endDate IS NULL OR a.endDate >= :now) " +
           "ORDER BY a.displayOrder ASC, a.createdAt DESC")
    List<Advertisement> findActiveAdvertisements(@Param("now") LocalDateTime now);
    
    List<Advertisement> findAllByOrderByDisplayOrderAscCreatedAtDesc();
}

