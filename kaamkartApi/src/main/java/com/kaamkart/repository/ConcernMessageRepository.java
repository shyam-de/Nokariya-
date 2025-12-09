package com.kaamkart.repository;

import com.kaamkart.model.Concern;
import com.kaamkart.model.ConcernMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConcernMessageRepository extends JpaRepository<ConcernMessage, Long> {
    List<ConcernMessage> findByConcernOrderByCreatedAtAsc(Concern concern);
}

