# Multi-stage build for KaamKart API
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Copy pom.xml first for better layer caching
COPY pom.xml .

# Download dependencies (this layer will be cached if pom.xml doesn't change)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -S spring && adduser -S spring -G spring

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chown -R spring:spring /app/logs

USER spring:spring

# Copy JAR from build stage
COPY --from=build /app/target/kaamkart-api-*.jar app.jar

# Expose port
EXPOSE 8585

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8585/api/health || exit 1

# Run application
# Render sets PORT environment variable, map it to server.port
ENTRYPOINT ["sh", "-c", "java -jar -Dspring.profiles.active=prod -Dserver.port=${PORT:-8585} app.jar"]

