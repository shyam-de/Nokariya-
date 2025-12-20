package com.kaamkart.service;

import com.kaamkart.model.Location;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Service to get location (latitude, longitude, address) from Indian pin code
 * Uses India Post Pin Code API and OpenStreetMap Nominatim for geocoding
 */
@Service
public class PinCodeGeocodingService {
    
    private static final Logger logger = LoggerFactory.getLogger(PinCodeGeocodingService.class);
    
    private static final String INDIA_POST_API_URL = "https://api.postalpincode.in/pincode/";
    private static final String NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";
    
    /**
     * Get location from pin code (latitude, longitude, and address)
     * @param pinCode 6-digit Indian pin code
     * @return Location object with latitude, longitude, and address, or null if geocoding fails
     */
    public Location getLocationFromPinCode(String pinCode) {
        if (pinCode == null || pinCode.trim().isEmpty() || !pinCode.matches("\\d{6}")) {
            logger.warn("Invalid pin code format: {}", pinCode);
            return null;
        }
        
        String pinCodeClean = pinCode.trim();
        logger.info("📍 Geocoding pin code: {}", pinCodeClean);
        
        try {
            // Step 1: Get address details from India Post API
            String address = null;
            String state = null;
            String city = null;
            
            try {
                String postApiUrl = INDIA_POST_API_URL + pinCodeClean;
                HttpURLConnection connection = (HttpURLConnection) new URL(postApiUrl).openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setRequestProperty("User-Agent", "KaamKart-App");
                
                int responseCode = connection.getResponseCode();
                if (responseCode == 200) {
                    BufferedReader reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();
                    
                    String jsonResponse = response.toString();
                    logger.debug("India Post API response for pin code {}: {}", pinCodeClean, jsonResponse);
                    
                    // Parse India Post API response
                    // Format: [{"Message":"Number of pincode(s) found:1","Status":"Success","PostOffice":[{"Name":"...","Description":"...","BranchType":"...","DeliveryStatus":"...","Circle":"...","District":"...","Division":"...","Region":"...","Block":"...","State":"...","Country":"India","Pincode":"..."}]}]
                    if (jsonResponse.contains("\"Status\":\"Success\"") && jsonResponse.contains("\"PostOffice\"")) {
                        // Extract PostOffice array
                        int postOfficeStart = jsonResponse.indexOf("\"PostOffice\":[");
                        if (postOfficeStart > 0) {
                            int postOfficeEnd = jsonResponse.indexOf("]", postOfficeStart);
                            if (postOfficeEnd > postOfficeStart) {
                                String postOfficeJson = jsonResponse.substring(postOfficeStart + 14, postOfficeEnd);
                                
                                // Extract first post office details
                                state = extractJsonValue(postOfficeJson, "State");
                                city = extractJsonValue(postOfficeJson, "District");
                                String name = extractJsonValue(postOfficeJson, "Name");
                                String block = extractJsonValue(postOfficeJson, "Block");
                                
                                // Build address
                                StringBuilder addressBuilder = new StringBuilder();
                                if (name != null && !name.isEmpty()) {
                                    addressBuilder.append(name);
                                }
                                if (block != null && !block.isEmpty() && !block.equals(name)) {
                                    if (addressBuilder.length() > 0) addressBuilder.append(", ");
                                    addressBuilder.append(block);
                                }
                                if (city != null && !city.isEmpty() && !city.equals(name)) {
                                    if (addressBuilder.length() > 0) addressBuilder.append(", ");
                                    addressBuilder.append(city);
                                }
                                if (state != null && !state.isEmpty()) {
                                    if (addressBuilder.length() > 0) addressBuilder.append(", ");
                                    addressBuilder.append(state);
                                }
                                if (addressBuilder.length() > 0) {
                                    addressBuilder.append(" ").append(pinCodeClean);
                                }
                                
                                address = addressBuilder.length() > 0 ? addressBuilder.toString() : 
                                          (city != null ? city + ", " + state + " " + pinCodeClean : 
                                           state != null ? state + " " + pinCodeClean : "Pin Code: " + pinCodeClean);
                            }
                        }
                    }
                }
            } catch (Exception e) {
                logger.warn("Failed to get address from India Post API for pin code {}: {}", pinCodeClean, e.getMessage());
            }
            
            // Step 2: Get latitude and longitude using Nominatim (OpenStreetMap)
            Double latitude = null;
            Double longitude = null;
            
            // Try multiple search strategies
            String[] searchQueries = new String[0];
            if (city != null && !city.isEmpty() && state != null && !state.isEmpty()) {
                searchQueries = new String[]{
                    city + ", " + state + ", India " + pinCodeClean,  // City, State, India PIN
                    pinCodeClean + ", " + city + ", " + state + ", India",  // PIN, City, State, India
                    city + ", " + state + ", India",  // City, State, India
                    pinCodeClean + ", India"  // PIN, India
                };
            } else if (city != null && !city.isEmpty()) {
                searchQueries = new String[]{
                    city + ", India " + pinCodeClean,
                    pinCodeClean + ", " + city + ", India",
                    city + ", India"
                };
            } else if (state != null && !state.isEmpty()) {
                searchQueries = new String[]{
                    state + ", India " + pinCodeClean,
                    pinCodeClean + ", " + state + ", India",
                    state + ", India"
                };
            } else {
                searchQueries = new String[]{
                    pinCodeClean + ", India"
                };
            }
            
            for (String searchQuery : searchQueries) {
                if (latitude != null && longitude != null) {
                    break; // Already got coordinates
                }
                
                try {
                    String nominatimUrl = NOMINATIM_API_URL + "?q=" + 
                        java.net.URLEncoder.encode(searchQuery, StandardCharsets.UTF_8) + 
                        "&format=json&limit=1&countrycodes=in";
                    
                    HttpURLConnection connection = (HttpURLConnection) new URL(nominatimUrl).openConnection();
                    connection.setRequestMethod("GET");
                    connection.setConnectTimeout(8000); // Increased timeout
                    connection.setReadTimeout(8000);
                    connection.setRequestProperty("User-Agent", "KaamKart-App/1.0 (Contact: support@kaamkart.com)");
                    connection.setRequestProperty("Accept-Language", "en");
                    
                    int responseCode = connection.getResponseCode();
                    if (responseCode == 200) {
                        BufferedReader reader = new BufferedReader(
                            new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
                        StringBuilder response = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            response.append(line);
                        }
                        reader.close();
                        
                        String jsonResponse = response.toString();
                        logger.debug("Nominatim API response for pin code {} (query: {}): {}", pinCodeClean, searchQuery, jsonResponse);
                        
                        // Parse Nominatim response: [{"place_id":...,"lat":"28.6139","lon":"77.2090",...}]
                        if (jsonResponse.startsWith("[") && jsonResponse.length() > 2 && jsonResponse.contains("\"lat\"") && jsonResponse.contains("\"lon\"")) {
                            String latStr = extractJsonValue(jsonResponse, "lat");
                            String lonStr = extractJsonValue(jsonResponse, "lon");
                            
                            if (latStr != null && lonStr != null) {
                                try {
                                    latitude = Double.parseDouble(latStr);
                                    longitude = Double.parseDouble(lonStr);
                                    logger.info("✅ Geocoded pin code {} using query '{}': lat={}, lon={}", 
                                            pinCodeClean, searchQuery, latitude, longitude);
                                    break; // Success, no need to try other queries
                                } catch (NumberFormatException e) {
                                    logger.warn("Failed to parse coordinates: lat={}, lon={}", latStr, lonStr);
                                }
                            }
                        }
                    } else {
                        logger.debug("Nominatim API returned status code: {} for pin code: {} (query: {})", 
                                responseCode, pinCodeClean, searchQuery);
                    }
                } catch (Exception e) {
                    logger.debug("Failed to geocode pin code {} using Nominatim with query '{}': {}", 
                            pinCodeClean, searchQuery, e.getMessage());
                }
            }
            
            if (latitude == null || longitude == null) {
                logger.warn("⚠️ Could not geocode pin code {} to get coordinates after trying {} queries", 
                        pinCodeClean, searchQueries.length);
            }
            
            // Create location object
            Location location = new Location();
            location.setLatitude(latitude);
            location.setLongitude(longitude);
            
            // Set address (use formatted address if available, otherwise use pin code)
            if (address != null && !address.isEmpty()) {
                location.setAddress(address);
            } else {
                location.setAddress("Pin Code: " + pinCodeClean);
            }
            
            // Only return location if we have at least address or coordinates
            if (location.getAddress() != null || (latitude != null && longitude != null)) {
                logger.info("📍 Location from pin code {}: Address: {}, Lat: {}, Lon: {}", 
                        pinCodeClean, location.getAddress(), latitude, longitude);
                return location;
            } else {
                logger.warn("Failed to geocode pin code {}: No address or coordinates found", pinCodeClean);
                return null;
            }
            
        } catch (Exception e) {
            logger.error("Error geocoding pin code {}: {}", pinCodeClean, e.getMessage(), e);
            return null;
        }
    }
    
    /**
     * Extract JSON value by key (simple parsing)
     */
    private String extractJsonValue(String json, String key) {
        try {
            String searchKey = "\"" + key + "\":";
            int keyIndex = json.indexOf(searchKey);
            if (keyIndex == -1) {
                return null;
            }
            
            int valueStart = keyIndex + searchKey.length();
            // Skip whitespace
            while (valueStart < json.length() && Character.isWhitespace(json.charAt(valueStart))) {
                valueStart++;
            }
            
            if (valueStart >= json.length()) {
                return null;
            }
            
            char firstChar = json.charAt(valueStart);
            if (firstChar == '"') {
                // String value
                int valueEnd = json.indexOf('"', valueStart + 1);
                if (valueEnd > valueStart) {
                    return json.substring(valueStart + 1, valueEnd);
                }
            } else {
                // Number or boolean value
                int valueEnd = valueStart;
                while (valueEnd < json.length() && 
                       (Character.isDigit(json.charAt(valueEnd)) || 
                        json.charAt(valueEnd) == '.' || 
                        json.charAt(valueEnd) == '-' ||
                        json.charAt(valueEnd) == 'e' ||
                        json.charAt(valueEnd) == 'E' ||
                        json.charAt(valueEnd) == '+' ||
                        json.charAt(valueEnd) == 't' || // true
                        json.charAt(valueEnd) == 'f')) { // false
                    valueEnd++;
                }
                if (valueEnd > valueStart) {
                    return json.substring(valueStart, valueEnd);
                }
            }
        } catch (Exception e) {
            logger.debug("Error extracting JSON value for key {}: {}", key, e.getMessage());
        }
        return null;
    }
}

