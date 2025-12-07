package com.nokariya.repository;

import com.nokariya.model.ConfirmedWorker;
import com.nokariya.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConfirmedWorkerRepository extends JpaRepository<ConfirmedWorker, Long> {
    List<ConfirmedWorker> findByWorkerOrderByConfirmedAtDesc(User worker);
}

