package com.nokariya.service;

import com.nokariya.dto.LoginRequest;
import com.nokariya.dto.RegisterRequest;
import com.nokariya.model.Location;
import com.nokariya.model.User;
import com.nokariya.model.Worker;
import com.nokariya.repository.UserRepository;
import com.nokariya.repository.WorkerRepository;
import com.nokariya.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
public class AuthService {
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Transactional
    public Map<String, Object> register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("User already exists");
        }

        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());

        if (request.getLocation() != null) {
            Location location = new Location();
            location.setLatitude(request.getLocation().getLatitude());
            location.setLongitude(request.getLocation().getLongitude());
            location.setAddress(request.getLocation().getAddress());
            user.setLocation(location);
        }

        user = userRepository.save(user);

        // If worker, create worker profile
        if (user.getRole() == User.UserRole.WORKER && request.getLaborTypes() != null) {
            Worker worker = new Worker();
            worker.setUser(user);
            worker.setLaborTypes(request.getLaborTypes());
            if (request.getLocation() != null) {
                Location currentLocation = new Location();
                currentLocation.setLatitude(request.getLocation().getLatitude());
                currentLocation.setLongitude(request.getLocation().getLongitude());
                currentLocation.setAddress(request.getLocation().getAddress());
                worker.setCurrentLocation(currentLocation);
            }
            workerRepository.save(worker);
        }

        String token = jwtUtil.generateToken(user.getId(), user.getRole().name());

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        Map<String, Object> userData = new HashMap<>();
        userData.put("id", user.getId());
        userData.put("name", user.getName());
        userData.put("email", user.getEmail());
        userData.put("role", user.getRole().name());
        response.put("user", userData);

        return response;
    }

    public Map<String, Object> login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getRole().name());

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        Map<String, Object> userData = new HashMap<>();
        userData.put("id", user.getId());
        userData.put("name", user.getName());
        userData.put("email", user.getEmail());
        userData.put("role", user.getRole().name());
        response.put("user", userData);

        return response;
    }
}

