package com.nokariya.repository;

import com.nokariya.model.DeployedWorker;
import com.nokariya.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeployedWorkerRepository extends JpaRepository<DeployedWorker, Long> {
    List<DeployedWorker> findByWorkerOrderByDeployedAtDesc(User worker);
}

