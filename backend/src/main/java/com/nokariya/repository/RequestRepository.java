package com.nokariya.repository;

import com.nokariya.model.Request;
import com.nokariya.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RequestRepository extends JpaRepository<Request, Long> {
    List<Request> findByCustomerOrderByCreatedAtDesc(User customer);
    List<Request> findByStatusIn(List<Request.RequestStatus> statuses);
    List<Request> findByStatusOrderByCreatedAtDesc(Request.RequestStatus status);
}

