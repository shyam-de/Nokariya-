package com.nokariya.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LocationDto {
    private Double latitude;
    private Double longitude;
    private String address;
    private String landmark;
}

