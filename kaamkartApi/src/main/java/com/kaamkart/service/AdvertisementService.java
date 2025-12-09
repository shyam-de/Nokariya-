package com.kaamkart.service;

import com.kaamkart.model.Advertisement;
import com.kaamkart.repository.AdvertisementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class AdvertisementService {
    
    private static final Logger logger = LoggerFactory.getLogger(AdvertisementService.class);
    
    @Autowired
    private AdvertisementRepository advertisementRepository;
    
    public List<Advertisement> getActiveAdvertisements() {
        return advertisementRepository.findActiveAdvertisements(LocalDateTime.now());
    }
    
    public List<Advertisement> getAllAdvertisements() {
        return advertisementRepository.findAllByOrderByDisplayOrderAscCreatedAtDesc();
    }
    
    public Optional<Advertisement> getAdvertisementById(Long id) {
        return advertisementRepository.findById(id);
    }
    
    @Transactional
    public Advertisement createAdvertisement(Advertisement advertisement) {
        logger.info("Creating advertisement: {}", advertisement.getTitle());
        if (advertisement.getStartDate() == null) {
            advertisement.setStartDate(LocalDateTime.now());
        }
        return advertisementRepository.save(advertisement);
    }
    
    @Transactional
    public Advertisement updateAdvertisement(Long id, Advertisement updatedAdvertisement) {
        logger.info("Updating advertisement with ID: {}", id);
        Advertisement existingAd = advertisementRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Advertisement not found with ID: " + id));
        
        existingAd.setTitle(updatedAdvertisement.getTitle());
        existingAd.setText(updatedAdvertisement.getText());
        existingAd.setImageUrl(updatedAdvertisement.getImageUrl());
        existingAd.setLinkUrl(updatedAdvertisement.getLinkUrl());
        existingAd.setLinkText(updatedAdvertisement.getLinkText());
        existingAd.setIsActive(updatedAdvertisement.getIsActive());
        existingAd.setDisplayOrder(updatedAdvertisement.getDisplayOrder());
        existingAd.setStartDate(updatedAdvertisement.getStartDate());
        existingAd.setEndDate(updatedAdvertisement.getEndDate());
        
        return advertisementRepository.save(existingAd);
    }
    
    @Transactional
    public void deleteAdvertisement(Long id) {
        logger.info("Deleting advertisement with ID: {}", id);
        if (!advertisementRepository.existsById(id)) {
            throw new RuntimeException("Advertisement not found with ID: " + id);
        }
        advertisementRepository.deleteById(id);
    }
}

