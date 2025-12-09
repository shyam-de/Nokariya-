package com.kaamkart.controller;

import com.kaamkart.model.Advertisement;
import com.kaamkart.model.SuccessStory;
import com.kaamkart.service.AdvertisementService;
import com.kaamkart.service.SuccessStoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/public")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class PublicController {
    
    private static final Logger logger = LoggerFactory.getLogger(PublicController.class);
    
    @Autowired
    private SuccessStoryService successStoryService;
    
    @Autowired
    private AdvertisementService advertisementService;
    
    @GetMapping("/success-stories")
    public ResponseEntity<?> getActiveSuccessStories() {
        try {
            List<SuccessStory> stories = successStoryService.getActiveStories();
            return ResponseEntity.ok(stories);
        } catch (Exception e) {
            logger.error("Error fetching success stories", e);
            return ResponseEntity.status(500).body(Map.of("message", "Error fetching success stories"));
        }
    }
    
    @GetMapping("/advertisements")
    public ResponseEntity<?> getActiveAdvertisements() {
        try {
            List<Advertisement> advertisements = advertisementService.getActiveAdvertisements();
            return ResponseEntity.ok(advertisements);
        } catch (Exception e) {
            logger.error("Error fetching advertisements", e);
            return ResponseEntity.status(500).body(Map.of("message", "Error fetching advertisements"));
        }
    }
}

