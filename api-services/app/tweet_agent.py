from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
import requests
import os

app = FastAPI(title="Tweet Agent API", version="1.0")

# ---------------------------------------------------------------------
# Authentication setup
# ---------------------------------------------------------------------
security = HTTPBearer()
API_KEY = os.getenv("API_KEY", "tweet-agent-secret-key-2024")

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
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "your-anthropic-api-key")
ANTHROPIC_BASE = "https://api.anthropic.com/v1/messages"
TIMEOUT = 30

# ---------------------------------------------------------------------
# Tweet Generation Functions
# ---------------------------------------------------------------------
def generate_tweet_thread(topic: str, research_data: str = "", post_count: int = 10):
    """Generate a Twitter thread using Claude API"""
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
    }
    
    system_prompt = """You are an expert social media copywriter specializing in creating engaging Twitter threads. 
    Create threads that are:
    - Hook-driven and attention-grabbing
    - Educational and valuable
    - Easy to read with clear structure
    - Include relevant hashtags
    - Use emojis strategically
    - End with a strong call-to-action
    
    Format each tweet with [1/10], [2/10], etc. for thread structure."""
    
    user_prompt = f"""Create a {post_count}-tweet thread about: {topic}
    
    {f"Use this research data: {research_data}" if research_data else ""}
    
    Make it engaging, educational, and shareable. Include hooks, valuable insights, and a strong CTA."""
    
    data = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 2000,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": user_prompt}
        ]
    }
    
    response = requests.post(ANTHROPIC_BASE, headers=headers, json=data, timeout=TIMEOUT)
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
        "service": "Tweet Agent API",
        "version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/generate")
def generate_tweets(
    topic: str = Query(..., description="Tweet thread topic"),
    research_data: str = Query("", description="Research data to include"),
    post_count: int = Query(10, description="Number of tweets in thread"),
    token: str = Depends(verify_token)
):
    """Generate a Twitter thread"""
    try:
        result = generate_tweet_thread(topic, research_data, post_count)
        
        return {
            "topic": topic,
            "post_count": post_count,
            "thread": result["content"][0]["text"],
            "source": "Claude 3.5 Sonnet",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cost_usd": 0.40
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tweet generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
