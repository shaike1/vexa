FROM python:3.11-slim

WORKDIR /app

COPY services/ai-service-adapter/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/ai-service-adapter/src/ ./src/

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["python", "-m", "src.main"]