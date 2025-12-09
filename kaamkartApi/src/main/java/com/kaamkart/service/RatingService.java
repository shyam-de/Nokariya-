package com.kaamkart.service;

import com.kaamkart.dto.CreateRatingDto;
import com.kaamkart.model.Rating;
import com.kaamkart.model.Request;
import com.kaamkart.model.User;
import com.kaamkart.model.Worker;
import com.kaamkart.repository.RatingRepository;
import com.kaamkart.repository.RequestRepository;
import com.kaamkart.repository.UserRepository;
import com.kaamkart.repository.WorkerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class RatingService {
    @Autowired
    private RatingRepository ratingRepository;

    @Autowired
    private RequestRepository requestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WorkerRepository workerRepository;

    @Transactional
    public Rating createRating(Long raterId, CreateRatingDto dto) {
        User rater = userRepository.findById(raterId)
                .orElseThrow(() -> new RuntimeException("Rater not found"));

        User rated = userRepository.findById(dto.getRatedUserId())
                .orElseThrow(() -> new RuntimeException("Rated user not found"));

        Request request = requestRepository.findById(dto.getRequestId())
                .orElseThrow(() -> new RuntimeException("Request not found"));

        // Check if request is completed
        if (request.getStatus() != Request.RequestStatus.COMPLETED) {
            throw new RuntimeException("Request must be completed before rating");
        }

        // Check if rater is part of this request (either customer or deployed worker)
        boolean isAuthorized = false;
        if (request.getCustomer().getId().equals(raterId)) {
            isAuthorized = true;
        } else {
            isAuthorized = request.getDeployedWorkers().stream()
                    .anyMatch(dw -> dw.getWorker().getId().equals(raterId));
        }

        if (!isAuthorized) {
            throw new RuntimeException("You are not authorized to rate this request");
        }

        // Check if rating already exists for this request and rater
        Optional<Rating> existingRating = ratingRepository.findByRequestAndRater(request, rater);
        Rating savedRating;
        if (existingRating.isPresent()) {
            // Update existing rating
            Rating rating = existingRating.get();
            rating.setRating(dto.getRating());
            rating.setComment(dto.getComment());
            savedRating = ratingRepository.save(rating);
        } else {
            // Create new rating
            Rating rating = new Rating();
            rating.setRequest(request);
            rating.setRater(rater);
            rating.setRated(rated);
            rating.setRating(dto.getRating());
            rating.setComment(dto.getComment());
            savedRating = ratingRepository.save(rating);
        }

        // Update worker's average rating if the rated user is a worker
        if (rated.getRole() == User.UserRole.WORKER) {
            updateWorkerRating(rated.getId());
        }
        // Note: Customer ratings are calculated dynamically from ratings table
        // No need to update a separate field for customers

        return savedRating;
    }

    @Transactional
    private void updateWorkerRating(Long workerUserId) {
        Optional<Worker> workerOpt = workerRepository.findByUserId(workerUserId);
        if (workerOpt.isPresent()) {
            Worker worker = workerOpt.get();
            List<Rating> ratings = ratingRepository.findByRated(worker.getUser());
            
            if (ratings.isEmpty()) {
                worker.setRating(0.0);
            } else {
                double averageRating = ratings.stream()
                        .mapToInt(Rating::getRating)
                        .average()
                        .orElse(0.0);
                // Round to 1 decimal place
                worker.setRating(Math.round(averageRating * 10.0) / 10.0);
            }
            
            workerRepository.save(worker);
        }
    }

    public List<Rating> getRatingsForUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ratingRepository.findByRated(user);
    }

    public Map<String, Object> getUserRatingStats(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        List<Rating> ratings = ratingRepository.findByRated(user);
        
        if (ratings.isEmpty()) {
            return Map.of(
                    "averageRating", 0.0,
                    "totalRatings", 0
            );
        }

        double averageRating = ratings.stream()
                .mapToInt(Rating::getRating)
                .average()
                .orElse(0.0);

        return Map.of(
                "averageRating", Math.round(averageRating * 10.0) / 10.0,
                "totalRatings", ratings.size()
        );
    }

    public boolean hasRatedForRequest(Long userId, Long requestId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));
        
        Optional<Rating> rating = ratingRepository.findByRequestAndRater(request, user);
        return rating.isPresent();
    }
}

