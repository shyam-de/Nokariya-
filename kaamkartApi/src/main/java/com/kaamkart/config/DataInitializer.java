package com.kaamkart.config;

import com.kaamkart.model.Advertisement;
import com.kaamkart.model.SuccessStory;
import com.kaamkart.model.SystemUser;
import com.kaamkart.model.WorkerType;
import com.kaamkart.repository.AdvertisementRepository;
import com.kaamkart.repository.SuccessStoryRepository;
import com.kaamkart.repository.SystemUserRepository;
import com.kaamkart.repository.WorkerTypeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Data Initializer - Ensures default data is present on application startup
 * This runs after the database is initialized and ensures default values exist
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataInitializer.class);

    @Autowired
    private WorkerTypeRepository workerTypeRepository;

    @Autowired
    private SuccessStoryRepository successStoryRepository;

    @Autowired
    private AdvertisementRepository advertisementRepository;

    @Autowired
    private SystemUserRepository systemUserRepository;

    @Override
    @Transactional
    public void run(String... args) {
        logger.info("Initializing default data...");
        
        initializeWorkerTypes();
        initializeSuccessStories();
        initializeAdvertisements();
        initializeSuperAdmin();
        
        logger.info("Default data initialization completed.");
    }

    private void initializeWorkerTypes() {
        logger.info("Initializing worker types...");
        
        List<WorkerType> defaultWorkerTypes = Arrays.asList(
            createWorkerType("ELECTRICIAN", "Electrician", "⚡", "Electrical repairs, installations & maintenance", 1),
            createWorkerType("DRIVER", "Driver", "🚗", "Professional drivers for all your transportation needs", 2),
            createWorkerType("RIGGER", "Rigger", "🔩", "Expert rigging and lifting services", 3),
            createWorkerType("FITTER", "Fitter", "🔧", "Mechanical fitting and assembly work", 4),
            createWorkerType("COOK", "Cook", "👨‍🍳", "Professional cooking and kitchen services", 5),
            createWorkerType("PLUMBER", "Plumber", "🔧", "Plumbing repairs, installations & maintenance", 6),
            createWorkerType("CARPENTER", "Carpenter", "🪚", "Carpentry, furniture & woodwork", 7),
            createWorkerType("PAINTER", "Painter", "🎨", "Interior & exterior painting services", 8),
            createWorkerType("UNSKILLED_WORKER", "Unskilled Worker", "👷", "Unskilled worker for all manual tasks", 9),
            createWorkerType("RAJ_MISTRI", "Raj Mistri", "👷‍♂️", "Supervisor & foreman for construction projects", 10)
        );

        for (WorkerType workerType : defaultWorkerTypes) {
            Optional<WorkerType> existing = workerTypeRepository.findByName(workerType.getName());
            if (existing.isPresent()) {
                // Update existing worker type
                WorkerType existingType = existing.get();
                existingType.setDisplayName(workerType.getDisplayName());
                existingType.setIcon(workerType.getIcon());
                existingType.setDescription(workerType.getDescription());
                existingType.setDisplayOrder(workerType.getDisplayOrder());
                existingType.setIsActive(true);
                workerTypeRepository.save(existingType);
                logger.debug("Updated worker type: {}", workerType.getName());
            } else {
                // Create new worker type
                workerTypeRepository.save(workerType);
                logger.debug("Created worker type: {}", workerType.getName());
            }
        }
        
        logger.info("Worker types initialized: {}", defaultWorkerTypes.size());
    }

    private WorkerType createWorkerType(String name, String displayName, String icon, String description, int order) {
        WorkerType workerType = new WorkerType();
        workerType.setName(name);
        workerType.setDisplayName(displayName);
        workerType.setIcon(icon);
        workerType.setDescription(description);
        workerType.setDisplayOrder(order);
        workerType.setIsActive(true);
        return workerType;
    }

    private void initializeSuccessStories() {
        logger.info("Initializing success stories...");
        
        List<SuccessStory> defaultStories = Arrays.asList(
            createSuccessStory("Excellent Electrical Work", 
                "Got my entire house rewired by an expert electrician from KaamKart. Professional service, timely completion, and reasonable pricing. Highly recommended!",
                "Rajesh Kumar", "Amit Sharma", "ELECTRICIAN", 5, 1),
            createSuccessStory("Reliable Driver Service",
                "Used KaamKart driver for my daily commute. Punctual, safe, and courteous. Made my life so much easier!",
                "Priya Singh", "Vikram Mehta", "DRIVER", 5, 2),
            createSuccessStory("Perfect Plumbing Solution",
                "Had a major leak in my bathroom. The plumber from KaamKart fixed it quickly and efficiently. Great work!",
                "Anil Verma", "Suresh Patel", "PLUMBER", 5, 3),
            createSuccessStory("Beautiful Home Painting",
                "Got my entire house painted through KaamKart. The painter did an amazing job with attention to detail. Love the results!",
                "Meera Joshi", "Ramesh Yadav", "PAINTER", 5, 4),
            createSuccessStory("Expert Carpentry Work",
                "Needed custom furniture for my home. The carpenter from KaamKart delivered exactly what I wanted. Excellent craftsmanship!",
                "Deepak Malhotra", "Kiran Reddy", "CARPENTER", 5, 5)
        );

        for (int i = 0; i < defaultStories.size(); i++) {
            SuccessStory story = defaultStories.get(i);
            // Check if story with same title exists
            List<SuccessStory> existing = successStoryRepository.findAll().stream()
                .filter(s -> s.getTitle().equals(story.getTitle()))
                .toList();
            
            if (existing.isEmpty()) {
                successStoryRepository.save(story);
                logger.debug("Created success story: {}", story.getTitle());
            } else {
                // Update existing story
                SuccessStory existingStory = existing.get(0);
                existingStory.setDescription(story.getDescription());
                existingStory.setCustomerName(story.getCustomerName());
                existingStory.setWorkerName(story.getWorkerName());
                existingStory.setWorkerType(story.getWorkerType());
                existingStory.setRating(story.getRating());
                existingStory.setIsActive(true);
                existingStory.setDisplayOrder(story.getDisplayOrder());
                successStoryRepository.save(existingStory);
                logger.debug("Updated success story: {}", story.getTitle());
            }
        }
        
        logger.info("Success stories initialized: {}", defaultStories.size());
    }

    private SuccessStory createSuccessStory(String title, String description, String customerName, 
                                           String workerName, String workerType, int rating, int order) {
        SuccessStory story = new SuccessStory();
        story.setTitle(title);
        story.setDescription(description);
        story.setCustomerName(customerName);
        story.setWorkerName(workerName);
        story.setWorkerType(workerType);
        story.setRating(rating);
        story.setIsActive(true);
        story.setDisplayOrder(order);
        return story;
    }

    private void initializeAdvertisements() {
        logger.info("Initializing advertisements...");
        
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime oneYearLater = now.plusYears(1);
        
        List<Advertisement> defaultAds = Arrays.asList(
            createAdvertisement("Find Skilled Workers Fast!",
                "Connect with verified workers for all your needs. Electricians, Plumbers, Drivers, and more. Book now!",
                "/login", "Get Started", 1, now, oneYearLater),
            createAdvertisement("Trusted by Thousands",
                "Join thousands of satisfied customers who found reliable workers through KaamKart. Your trusted labor connection platform.",
                "/", "Learn More", 2, now, oneYearLater),
            createAdvertisement("Verified Workers Only",
                "All workers on KaamKart are verified and background checked. Your safety and satisfaction is our priority.",
                "/login", "Browse Workers", 3, now, oneYearLater)
        );

        for (Advertisement ad : defaultAds) {
            // Check if advertisement with same title exists
            List<Advertisement> existing = advertisementRepository.findAll().stream()
                .filter(a -> a.getTitle().equals(ad.getTitle()))
                .toList();
            
            if (existing.isEmpty()) {
                advertisementRepository.save(ad);
                logger.debug("Created advertisement: {}", ad.getTitle());
            } else {
                // Update existing advertisement
                Advertisement existingAd = existing.get(0);
                existingAd.setText(ad.getText());
                existingAd.setLinkUrl(ad.getLinkUrl());
                existingAd.setLinkText(ad.getLinkText());
                existingAd.setIsActive(true);
                existingAd.setDisplayOrder(ad.getDisplayOrder());
                existingAd.setStartDate(ad.getStartDate());
                existingAd.setEndDate(ad.getEndDate());
                advertisementRepository.save(existingAd);
                logger.debug("Updated advertisement: {}", ad.getTitle());
            }
        }
        
        logger.info("Advertisements initialized: {}", defaultAds.size());
    }

    private Advertisement createAdvertisement(String title, String text, String linkUrl, 
                                             String linkText, int order, LocalDateTime startDate, LocalDateTime endDate) {
        Advertisement ad = new Advertisement();
        ad.setTitle(title);
        ad.setText(text);
        ad.setLinkUrl(linkUrl);
        ad.setLinkText(linkText);
        ad.setIsActive(true);
        ad.setDisplayOrder(order);
        ad.setStartDate(startDate);
        ad.setEndDate(endDate);
        return ad;
    }

    private void initializeSuperAdmin() {
        logger.info("Initializing super admin user...");
        
        // Super Admin: superadmin@kaamkart.in
        String superAdminEmail = "superadmin@kaamkart.in";
        Optional<SystemUser> existingSuperAdmin = systemUserRepository.findByEmail(superAdminEmail);
        
        if (existingSuperAdmin.isEmpty()) {
            SystemUser superAdmin = new SystemUser();
            superAdmin.setName("Super Admin");
            superAdmin.setEmail(superAdminEmail);
            superAdmin.setPhone("1234567890");
            superAdmin.setPassword("$2a$10$AZo6H41WujUc9x8z0pJ9qe7joFJCiY.a1LF8wEERVdU.g2PoBn6QK"); // Ankit@805204
            superAdmin.setSuperAdmin(true);
            superAdmin.setBlocked(false);
            systemUserRepository.save(superAdmin);
            logger.info("Created super admin user: {}", superAdminEmail);
        } else {
            SystemUser admin = existingSuperAdmin.get();
            // Ensure super admin privileges are set
            if (!admin.getSuperAdmin()) {
                admin.setSuperAdmin(true);
                admin.setBlocked(false);
                systemUserRepository.save(admin);
                logger.info("Updated super admin privileges for: {}", superAdminEmail);
            } else {
                logger.debug("Super admin user already exists: {}", superAdminEmail);
            }
        }
        
        logger.info("Super admin initialization completed.");
    }
}

