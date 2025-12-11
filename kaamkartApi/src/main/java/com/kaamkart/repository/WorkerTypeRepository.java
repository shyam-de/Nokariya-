package com.kaamkart.repository;

import com.kaamkart.model.WorkerType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkerTypeRepository extends JpaRepository<WorkerType, Long> {
    Optional<WorkerType> findByName(String name);
    boolean existsByName(String name);
    
    @Query("SELECT wt FROM WorkerType wt WHERE wt.isActive = true ORDER BY wt.displayOrder ASC, wt.name ASC")
    List<WorkerType> findActiveWorkerTypesOrdered();
    
    List<WorkerType> findAllByOrderByDisplayOrderAscNameAsc();
}

