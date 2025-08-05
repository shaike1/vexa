FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy bridge application
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' bridgeuser
RUN chown -R bridgeuser:bridgeuser /app
USER bridgeuser

# Expose WebSocket port
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import socket; s=socket.socket(); s.settimeout(5); s.connect(('localhost', 8765)); s.close()" || exit 1

# Start the bridge
CMD ["python", "bridge.py"]