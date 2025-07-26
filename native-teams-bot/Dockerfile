# Use the official .NET SDK for building
FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build

# Set working directory
WORKDIR /app

# Copy project files
COPY VexaSpeakerBot/VexaSpeakerBot.csproj VexaSpeakerBot/
WORKDIR /app/VexaSpeakerBot

# Restore packages
RUN dotnet restore

# Copy source code
COPY VexaSpeakerBot/ .

# Build the application
RUN dotnet build --configuration Release --no-restore

# Publish the application
RUN dotnet publish --configuration Release --no-build --output /app/publish

# Use the official .NET runtime for running
FROM mcr.microsoft.com/dotnet/aspnet:6.0 AS runtime

# Install curl for health checks and espeak for local TTS
RUN apt-get update && apt-get install -y curl espeak espeak-data alsa-utils && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy published application
COPY --from=build /app/publish .

# Create a non-root user
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /app
USER appuser

# Expose ports
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/messages || exit 1

# Set environment variables
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

# Start the application
ENTRYPOINT ["dotnet", "VexaSpeakerBot.dll"]