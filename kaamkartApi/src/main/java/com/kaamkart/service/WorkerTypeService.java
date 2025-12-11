package com.kaamkart.service;

import com.kaamkart.model.WorkerType;
import com.kaamkart.repository.WorkerTypeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class WorkerTypeService {
    
    private static final Logger logger = LoggerFactory.getLogger(WorkerTypeService.class);
    
    @Autowired
    private WorkerTypeRepository workerTypeRepository;
    
    public List<WorkerType> getActiveWorkerTypes() {
        return workerTypeRepository.findActiveWorkerTypesOrdered();
    }
    
    public List<WorkerType> getAllWorkerTypes() {
        return workerTypeRepository.findAllByOrderByDisplayOrderAscNameAsc();
    }
    
    public Optional<WorkerType> getWorkerTypeById(Long id) {
        return workerTypeRepository.findById(id);
    }
    
    public Optional<WorkerType> getWorkerTypeByName(String name) {
        return workerTypeRepository.findByName(name.toUpperCase());
    }
    
    @Transactional
    public WorkerType createWorkerType(WorkerType workerType) {
        logger.info("Creating worker type: {}", workerType.getName());
        
        // Normalize name to uppercase
        String normalizedName = workerType.getName().toUpperCase().trim();
        
        // Check if already exists
        if (workerTypeRepository.existsByName(normalizedName)) {
            throw new RuntimeException("Worker type with name '" + normalizedName + "' already exists");
        }
        
        workerType.setName(normalizedName);
        return workerTypeRepository.save(workerType);
    }
    
    @Transactional
    public WorkerType updateWorkerType(Long id, WorkerType updatedWorkerType) {
        logger.info("Updating worker type with ID: {}", id);
        WorkerType existing = workerTypeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker type not found with ID: " + id));
        
        // If name is being changed, check for duplicates
        String newName = updatedWorkerType.getName().toUpperCase().trim();
        if (!existing.getName().equals(newName)) {
            if (workerTypeRepository.existsByName(newName)) {
                throw new RuntimeException("Worker type with name '" + newName + "' already exists");
            }
            existing.setName(newName);
        }
        
        existing.setDisplayName(updatedWorkerType.getDisplayName());
        existing.setIcon(updatedWorkerType.getIcon());
        existing.setDescription(updatedWorkerType.getDescription());
        existing.setIsActive(updatedWorkerType.getIsActive());
        existing.setDisplayOrder(updatedWorkerType.getDisplayOrder());
        
        return workerTypeRepository.save(existing);
    }
    
    @Transactional
    public void deleteWorkerType(Long id) {
        logger.info("Deleting worker type with ID: {}", id);
        if (!workerTypeRepository.existsById(id)) {
            throw new RuntimeException("Worker type not found with ID: " + id);
        }
        workerTypeRepository.deleteById(id);
    }
    
    @Transactional
    public WorkerType toggleActiveStatus(Long id) {
        logger.info("Toggling active status for worker type with ID: {}", id);
        WorkerType workerType = workerTypeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker type not found with ID: " + id));
        
        workerType.setIsActive(!workerType.getIsActive());
        return workerTypeRepository.save(workerType);
    }
}

