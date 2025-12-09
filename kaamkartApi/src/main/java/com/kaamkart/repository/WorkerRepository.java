package com.kaamkart.repository;

import com.kaamkart.model.User;
import com.kaamkart.model.Worker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkerRepository extends JpaRepository<Worker, Long> {
    Optional<Worker> findByUser(User user);
    Optional<Worker> findByUserId(Long userId);
    
    @Query("SELECT w FROM Worker w WHERE :laborType MEMBER OF w.laborTypes AND w.available = true AND w.verified = true")
    List<Worker> findAvailableWorkersByLaborType(@Param("laborType") Worker.LaborType laborType);

    List<Worker> findAllByOrderByCreatedAtDesc();
}

