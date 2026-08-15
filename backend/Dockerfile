FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jdk-jammy
WORKDIR /app

# ffmpeg is required by MediaMetadataScrubber to strip metadata
# (GPS/device/timestamps) from uploaded videos before they reach R2.
# Without it, video uploads still work but skip that scrubbing step
# (image scrubbing doesn't need it — that's pure Java).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
