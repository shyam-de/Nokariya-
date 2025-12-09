package com.kaamkart.repository;

import com.kaamkart.model.SuccessStory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SuccessStoryRepository extends JpaRepository<SuccessStory, Long> {
    
    List<SuccessStory> findByIsActiveTrueOrderByDisplayOrderAscCreatedAtDesc();
    
    @Query("SELECT s FROM SuccessStory s WHERE s.isActive = true ORDER BY s.displayOrder ASC, s.createdAt DESC")
    List<SuccessStory> findActiveStoriesOrdered();
}

