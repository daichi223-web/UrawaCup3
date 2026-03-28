FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and download TrueType Japanese font
RUN apt-get update && apt-get install -y curl \
    && mkdir -p /usr/share/fonts/truetype/noto \
    && curl -L -o "/usr/share/fonts/truetype/noto/NotoSansJP[wght].ttf" \
       "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf" \
    && apt-get purge -y curl && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8001

# Run the application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
