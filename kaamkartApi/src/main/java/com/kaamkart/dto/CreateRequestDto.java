package com.kaamkart.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class CreateRequestDto {
    @NotNull(message = "Labor type requirements are required")
    private List<LaborTypeRequirementDto> laborTypeRequirements;

    @NotBlank(message = "Work type is required")
    private String workType;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    @NotNull(message = "End date is required")
    private LocalDate endDate;

    @NotNull(message = "Location is required")
    private LocationDto location;
}

