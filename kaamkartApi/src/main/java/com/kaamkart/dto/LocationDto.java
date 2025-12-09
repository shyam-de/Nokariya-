package com.kaamkart.dto;

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
    // Address fields for geocoding when lat/long not provided
    private String state;
    private String city;
    private String pinCode;
    private String area;
}

