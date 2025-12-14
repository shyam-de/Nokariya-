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
 * Service to get location from IP address using free IP geolocation API
 */
@Service
public class IpGeolocationService {
    
    private static final Logger logger = LoggerFactory.getLogger(IpGeolocationService.class);
    
    // Using ip-api.com (free, no API key required, 45 requests/minute limit)
    private static final String IP_GEOLOCATION_URL = "http://ip-api.com/json/";
    
    /**
     * Get location from IP address
     * @param ipAddress Client IP address
     * @return Location object with latitude, longitude, and address, or null if geolocation fails
     */
    public Location getLocationFromIp(String ipAddress) {
        if (ipAddress == null || ipAddress.trim().isEmpty() || 
            ipAddress.equals("127.0.0.1") || ipAddress.equals("localhost") ||
            ipAddress.startsWith("0:0:0:0:0:0:0:1") || ipAddress.equals("::1")) {
            logger.debug("Skipping geolocation for localhost/IP: {}", ipAddress);
            return null;
        }
        
        try {
            String url = IP_GEOLOCATION_URL + ipAddress;
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000); // 5 seconds timeout
            connection.setReadTimeout(5000);
            connection.setRequestProperty("User-Agent", "KaamKart-App");
            
            int responseCode = connection.getResponseCode();
            if (responseCode != 200) {
                logger.warn("IP geolocation API returned status code: {} for IP: {}", responseCode, ipAddress);
                return null;
            }
            
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();
            
            // Parse JSON response
            String jsonResponse = response.toString();
            logger.debug("IP geolocation response for {}: {}", ipAddress, jsonResponse);
            
            // Simple JSON parsing (ip-api.com format)
            // {"status":"success","country":"India","regionName":"Delhi","city":"New Delhi","lat":28.6139,"lon":77.2090,"timezone":"Asia/Kolkata","isp":"...","query":"..."}
            if (jsonResponse.contains("\"status\":\"success\"")) {
                Location location = new Location();
                
                // Extract latitude
                String latMatch = extractJsonValue(jsonResponse, "lat");
                if (latMatch != null) {
                    try {
                        location.setLatitude(Double.parseDouble(latMatch));
                    } catch (NumberFormatException e) {
                        logger.warn("Failed to parse latitude: {}", latMatch);
                    }
                }
                
                // Extract longitude
                String lonMatch = extractJsonValue(jsonResponse, "lon");
                if (lonMatch != null) {
                    try {
                        location.setLongitude(Double.parseDouble(lonMatch));
                    } catch (NumberFormatException e) {
                        logger.warn("Failed to parse longitude: {}", lonMatch);
                    }
                }
                
                // Build address from city, region, country
                String city = extractJsonValue(jsonResponse, "city");
                String region = extractJsonValue(jsonResponse, "regionName");
                String country = extractJsonValue(jsonResponse, "country");
                
                StringBuilder addressBuilder = new StringBuilder();
                if (city != null && !city.isEmpty()) {
                    addressBuilder.append(city);
                }
                if (region != null && !region.isEmpty()) {
                    if (addressBuilder.length() > 0) addressBuilder.append(", ");
                    addressBuilder.append(region);
                }
                if (country != null && !country.isEmpty()) {
                    if (addressBuilder.length() > 0) addressBuilder.append(", ");
                    addressBuilder.append(country);
                }
                
                if (addressBuilder.length() > 0) {
                    location.setAddress(addressBuilder.toString());
                }
                
                // Only return location if we have valid coordinates
                if (location.getLatitude() != null && location.getLongitude() != null) {
                    logger.info("📍 Location detected from IP {}: {} (lat: {}, lon: {})", 
                            ipAddress, location.getAddress(), location.getLatitude(), location.getLongitude());
                    return location;
                }
            } else {
                logger.warn("IP geolocation failed for IP: {} - Response: {}", ipAddress, jsonResponse);
            }
            
        } catch (Exception e) {
            logger.error("Error getting location from IP {}: {}", ipAddress, e.getMessage(), e);
        }
        
        return null;
    }
    
    /**
     * Extract JSON value by key (simple parsing)
     */
    private String extractJsonValue(String json, String key) {
        try {
            String searchKey = "\"" + key + "\":";
            int keyIndex = json.indexOf(searchKey);
            if (keyIndex == -1) return null;
            
            int valueStart = keyIndex + searchKey.length();
            // Skip whitespace
            while (valueStart < json.length() && Character.isWhitespace(json.charAt(valueStart))) {
                valueStart++;
            }
            
            if (valueStart >= json.length()) return null;
            
            // Check if value is a string (starts with ")
            if (json.charAt(valueStart) == '"') {
                int valueEnd = json.indexOf('"', valueStart + 1);
                if (valueEnd == -1) return null;
                return json.substring(valueStart + 1, valueEnd);
            } else {
                // Number value
                int valueEnd = valueStart;
                while (valueEnd < json.length() && 
                       (Character.isDigit(json.charAt(valueEnd)) || 
                        json.charAt(valueEnd) == '.' || 
                        json.charAt(valueEnd) == '-' ||
                        json.charAt(valueEnd) == 'e' ||
                        json.charAt(valueEnd) == 'E' ||
                        json.charAt(valueEnd) == '+')) {
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

