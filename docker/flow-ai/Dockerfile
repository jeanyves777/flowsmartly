FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server
COPY server.py .

# Model cache directory (mount as volume for persistence)
ENV HF_HOME=/root/.cache/huggingface
ENV DEVICE=cpu

EXPOSE 7860

CMD ["python", "server.py"]
