from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
import requests
import os

app = FastAPI(title="Research Agent API", version="1.0")

# ---------------------------------------------------------------------
# Authentication setup
# ---------------------------------------------------------------------
security = HTTPBearer()
API_KEY = os.getenv("API_KEY", "research-agent-secret-key-2024")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify the bearer token"""
    if credentials.credentials != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return credentials.credentials

# ---------------------------------------------------------------------
# CORS setup
# ---------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "your-perplexity-api-key")
PERPLEXITY_BASE = "https://api.perplexity.ai/chat/completions"
TIMEOUT = 30

# ---------------------------------------------------------------------
# Research Functions
# ---------------------------------------------------------------------
def call_perplexity(query: str, max_tokens: int = 1000):
    """Call Perplexity API for research"""
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "llama-3.1-sonar-small-128k-online",
        "messages": [
            {
                "role": "system",
                "content": "You are a research assistant. Provide comprehensive, factual information based on current data."
            },
            {
                "role": "user", 
                "content": query
            }
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2
    }
    
    response = requests.post(PERPLEXITY_BASE, headers=headers, json=data, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()

# ---------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------
@app.get("/health")
def health_check():
    """Health check endpoint (no authentication required)"""
    return {
        "status": "healthy",
        "service": "Research Agent API",
        "version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/research")
def research(
    query: str = Query(..., description="Research query"),
    max_tokens: int = Query(1000, description="Maximum tokens to generate"),
    token: str = Depends(verify_token)
):
    """Conduct research using Perplexity API"""
    try:
        result = call_perplexity(query, max_tokens)
        
        return {
            "query": query,
            "max_tokens": max_tokens,
            "result": result,
            "source": "Perplexity",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cost_usd": 0.30
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Research failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
