# Run Mindsence anywhere Docker runs:
#   docker build -t mindsence .
#   docker run -p 5000:5000 -v mindsence-data:/data -e ANTHROPIC_API_KEY=sk-ant-... mindsence
# The volume keeps user accounts across restarts. Keep ONE worker: login rate limits live in memory.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn
COPY . .
RUN python tools/get_vendor.py || true
ENV MINDSENCE_HOST=0.0.0.0 PORT=5000 PYTHONUNBUFFERED=1 MINDSENCE_DB=/data/mindsence.db
VOLUME /data
EXPOSE 5000
# gthread: streaming replies keep a request open, so use threads instead of one blocking worker
CMD ["sh", "-c", "gunicorn -k gthread --threads 8 --timeout 120 -b 0.0.0.0:${PORT} app:app"]
