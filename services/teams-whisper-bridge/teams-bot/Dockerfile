FROM mcr.microsoft.com/dotnet/aspnet:6.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /src
COPY ["VexaTeamsBot.csproj", "./"]
RUN dotnet restore "VexaTeamsBot.csproj"
COPY . .
WORKDIR "/src"
RUN dotnet build "VexaTeamsBot.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "VexaTeamsBot.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Create non-root user for security
RUN adduser --disabled-password --gecos '' dotnetuser
RUN chown -R dotnetuser:dotnetuser /app
USER dotnetuser

ENTRYPOINT ["dotnet", "VexaTeamsBot.dll"]