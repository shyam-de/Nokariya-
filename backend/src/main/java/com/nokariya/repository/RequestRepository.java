package com.nokariya.repository;

import com.nokariya.model.Request;
import com.nokariya.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RequestRepository extends JpaRepository<Request, Long> {
    @Query("SELECT DISTINCT r FROM Request r " +
           "LEFT JOIN FETCH r.deployedWorkers dw " +
           "LEFT JOIN FETCH dw.worker " +
           "WHERE r.customer = :customer ORDER BY r.createdAt DESC")
    List<Request> findByCustomerOrderByCreatedAtDesc(@Param("customer") User customer);
    
    @Query("SELECT DISTINCT r FROM Request r " +
           "WHERE r.status IN :statuses")
    List<Request> findByStatusIn(@Param("statuses") List<Request.RequestStatus> statuses);
    
    List<Request> findByStatusOrderByCreatedAtDesc(Request.RequestStatus status);
}

