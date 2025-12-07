package com.nokariya.service;

import com.nokariya.dto.UpdateProfileDto;
import com.nokariya.model.Location;
import com.nokariya.model.User;
import com.nokariya.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
public class ProfileService {
    @Autowired
    private UserRepository userRepository;

    public User getUserProfile(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @Transactional
    public User updateProfile(Long userId, UpdateProfileDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check if email is being changed and if it's already taken
        if (!user.getEmail().equals(dto.getEmail()) && userRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("Email already exists");
        }

        user.setName(dto.getName());
        user.setEmail(dto.getEmail());
        user.setPhone(dto.getPhone());
        user.setSecondaryPhone(dto.getSecondaryPhone());

        if (dto.getLocation() != null) {
            Location location = new Location();
            location.setLatitude(dto.getLocation().getLatitude());
            location.setLongitude(dto.getLocation().getLongitude());
            location.setAddress(dto.getLocation().getAddress());
            user.setLocation(location);
        }

        return userRepository.save(user);
    }

    public Map<String, Object> getProfileResponse(User user) {
        Map<String, Object> profile = new HashMap<>();
        profile.put("id", user.getId());
        profile.put("name", user.getName());
        profile.put("email", user.getEmail());
        profile.put("phone", user.getPhone());
        profile.put("secondaryPhone", user.getSecondaryPhone());
        profile.put("role", user.getRole().name());
        profile.put("location", user.getLocation());
        return profile;
    }
}

