package com.kaamkart.dto;

import com.kaamkart.model.Worker;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LaborTypeRequirementDto {
    @NotNull(message = "Labor type is required")
    private Worker.LaborType laborType;

    @NotNull(message = "Number of workers is required")
    @Min(value = 1, message = "Number of workers must be at least 1")
    private Integer numberOfWorkers;
}

