package com.kaamkart.dto;

import com.kaamkart.model.Concern;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateConcernDto {
    private Long requestId; // Optional - if concern is related to a specific request

    private Long relatedToUserId; // Optional - if concern is about a specific user

    @NotBlank(message = "Description is required")
    private String description;

    @NotNull(message = "Concern type is required")
    private Concern.ConcernType type;
}

