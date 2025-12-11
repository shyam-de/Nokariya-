package com.kaamkart.dto;


import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkerTypeRequirementDto {
    @NotBlank(message = "Worker type is required")
    private String workerType;

    @NotNull(message = "Number of workers is required")
    @Min(value = 1, message = "Number of workers must be at least 1")
    private Integer numberOfWorkers;
}

