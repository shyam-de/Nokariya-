package com.nokariya.service;

import com.nokariya.dto.CreateRatingDto;
import com.nokariya.model.Rating;
import com.nokariya.model.Request;
import com.nokariya.model.User;
import com.nokariya.repository.RatingRepository;
import com.nokariya.repository.RequestRepository;
import com.nokariya.repository.UserRepository;
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
        if (existingRating.isPresent()) {
            // Update existing rating
            Rating rating = existingRating.get();
            rating.setRating(dto.getRating());
            rating.setComment(dto.getComment());
            return ratingRepository.save(rating);
        }

        // Create new rating
        Rating rating = new Rating();
        rating.setRequest(request);
        rating.setRater(rater);
        rating.setRated(rated);
        rating.setRating(dto.getRating());
        rating.setComment(dto.getComment());

        return ratingRepository.save(rating);
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
}

