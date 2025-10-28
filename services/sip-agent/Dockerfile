# Python 3.11 slim, small & fast
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY sip_agent /app/sip_agent
COPY .env.example /app/.env.example

# Default: run one SIP window (you’ll cron/k8s this)
CMD ["python", "-m", "sip_agent.main"]
