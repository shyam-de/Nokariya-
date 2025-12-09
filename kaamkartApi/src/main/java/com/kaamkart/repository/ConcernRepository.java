package com.kaamkart.repository;

import com.kaamkart.model.Concern;
import com.kaamkart.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConcernRepository extends JpaRepository<Concern, Long> {
    @Query("SELECT DISTINCT c FROM Concern c " +
           "LEFT JOIN FETCH c.request " +
           "LEFT JOIN FETCH c.raisedBy " +
           "LEFT JOIN FETCH c.relatedTo " +
           "WHERE c.raisedBy = :user ORDER BY c.createdAt DESC")
    List<Concern> findByRaisedByOrderByCreatedAtDesc(@Param("user") User user);
    
    @Query("SELECT DISTINCT c FROM Concern c " +
           "LEFT JOIN FETCH c.request " +
           "LEFT JOIN FETCH c.raisedBy " +
           "LEFT JOIN FETCH c.relatedTo " +
           "WHERE c.status = :status ORDER BY c.createdAt DESC")
    List<Concern> findByStatusOrderByCreatedAtDesc(@Param("status") Concern.ConcernStatus status);
    
    @Query("SELECT DISTINCT c FROM Concern c " +
           "LEFT JOIN FETCH c.request " +
           "LEFT JOIN FETCH c.raisedBy " +
           "LEFT JOIN FETCH c.relatedTo " +
           "ORDER BY c.createdAt DESC")
    List<Concern> findAllByOrderByCreatedAtDesc();
}

