package com.kaamkart.repository;

import com.kaamkart.model.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    
    Optional<PasswordResetToken> findByToken(String token);
    
    Optional<PasswordResetToken> findByTokenAndUsedFalse(String token);
    
    @Query("SELECT t FROM PasswordResetToken t WHERE t.userId = :userId AND t.isSystemUser = :isSystemUser AND t.used = false AND t.expiresAt > :now ORDER BY t.createdAt DESC")
    Optional<PasswordResetToken> findLatestValidTokenByUser(@Param("userId") Long userId, 
                                                             @Param("isSystemUser") Boolean isSystemUser,
                                                             @Param("now") LocalDateTime now);
    
    @Modifying
    @Query("UPDATE PasswordResetToken t SET t.used = true WHERE t.userId = :userId AND t.isSystemUser = :isSystemUser AND t.used = false")
    void invalidateAllTokensForUser(@Param("userId") Long userId, @Param("isSystemUser") Boolean isSystemUser);
    
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt < :now")
    void deleteExpiredTokens(@Param("now") LocalDateTime now);
}

