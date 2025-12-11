package com.kaamkart.service;

import com.kaamkart.model.SuccessStory;
import com.kaamkart.repository.SuccessStoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class SuccessStoryService {
    
    private static final Logger logger = LoggerFactory.getLogger(SuccessStoryService.class);
    
    @Autowired
    private SuccessStoryRepository successStoryRepository;
    
    public List<SuccessStory> getActiveStories() {
        return successStoryRepository.findActiveStoriesOrdered();
    }
    
    public List<SuccessStory> getAllStories() {
        return successStoryRepository.findAll();
    }
    
    public Optional<SuccessStory> getStoryById(Long id) {
        return successStoryRepository.findById(id);
    }
    
    @Transactional
    public SuccessStory createStory(SuccessStory story) {
        logger.info("Creating success story: {}", story.getTitle());
        return successStoryRepository.save(story);
    }
    
    @Transactional
    public SuccessStory updateStory(Long id, SuccessStory updatedStory) {
        logger.info("Updating success story with ID: {}", id);
        SuccessStory existingStory = successStoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Success story not found with ID: " + id));
        
        existingStory.setTitle(updatedStory.getTitle());
        existingStory.setDescription(updatedStory.getDescription());
        existingStory.setCustomerName(updatedStory.getCustomerName());
        existingStory.setWorkerName(updatedStory.getWorkerName());
        existingStory.setWorkerType(updatedStory.getWorkerType());
        existingStory.setRating(updatedStory.getRating());
        existingStory.setImageUrl(updatedStory.getImageUrl());
        existingStory.setIsActive(updatedStory.getIsActive());
        existingStory.setDisplayOrder(updatedStory.getDisplayOrder());
        
        return successStoryRepository.save(existingStory);
    }
    
    @Transactional
    public void deleteStory(Long id) {
        logger.info("Deleting success story with ID: {}", id);
        if (!successStoryRepository.existsById(id)) {
            throw new RuntimeException("Success story not found with ID: " + id);
        }
        successStoryRepository.deleteById(id);
    }
}

