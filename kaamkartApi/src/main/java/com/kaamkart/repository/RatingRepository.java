package com.kaamkart.repository;

import com.kaamkart.model.Rating;
import com.kaamkart.model.Request;
import com.kaamkart.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RatingRepository extends JpaRepository<Rating, Long> {
    List<Rating> findByRated(User rated);
    List<Rating> findByRater(User rater);
    Optional<Rating> findByRequestAndRater(Request request, User rater);
    List<Rating> findByRequest(Request request);
}

