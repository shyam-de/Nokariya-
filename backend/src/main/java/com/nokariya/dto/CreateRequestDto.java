package com.nokariya.dto;

import com.nokariya.model.Request;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateRequestDto {
    @NotNull(message = "Labor type is required")
    private Request.LaborType laborType;

    @NotBlank(message = "Work type is required")
    private String workType;

    @NotNull(message = "Number of workers is required")
    @Min(value = 1, message = "Number of workers must be at least 1")
    private Integer numberOfWorkers;

    @NotNull(message = "Location is required")
    private LocationDto location;
}

