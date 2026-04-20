package com.example.sas.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

@Data
public class UserProfileUpdateDto {

    @NotBlank(message = "Full name is required")
    private String fullName;

    @jakarta.validation.constraints.Pattern(regexp = "^\\d{10}$", message = "Phone number must be exactly 10 digits")
    private String phone;

    private String address;

    private MultipartFile profilePicture;

    private String currentPassword;

    private String newPassword;

    private String confirmNewPassword;

    // Staff extensions
    private String[] availability;
    
    @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.TIME)
    private java.time.LocalTime availableFromTime;
    
    @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.TIME)
    private java.time.LocalTime availableToTime;
}
