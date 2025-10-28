from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
import requests
import os

app = FastAPI(title="Blog Agent API", version="1.0")

# ---------------------------------------------------------------------
# Authentication setup
# ---------------------------------------------------------------------
security = HTTPBearer()
API_KEY = os.getenv("API_KEY", "blog-agent-secret-key-2024")

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
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-openai-api-key")
OPENAI_BASE = "https://api.openai.com/v1/chat/completions"
TIMEOUT = 60

# ---------------------------------------------------------------------
# Blog Generation Functions
# ---------------------------------------------------------------------
def generate_blog(topic: str, research_data: str = "", word_count: int = 1500, style: str = "Indian Market Copywriter"):
    """Generate blog content using OpenAI API"""
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    system_prompt = f"""You are an expert {style} specializing in creating engaging, SEO-optimized blog content for the Indian market. 
    Write in a conversational tone that resonates with Indian audiences. Include relevant examples, statistics, and actionable insights.
    Structure your content with clear headings, subheadings, and bullet points for better readability."""
    
    user_prompt = f"""Write a {word_count}-word SEO-optimized blog post about: {topic}
    
    {f"Use this research data: {research_data}" if research_data else ""}
    
    Requirements:
    - Write for Indian audience
    - Include SEO keywords naturally
    - Use engaging headlines and subheadings
    - Add actionable insights
    - Include relevant examples
    - Make it scannable with bullet points
    - End with a strong call-to-action"""
    
    data = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": word_count * 2,  # Allow extra tokens for formatting
        "temperature": 0.7
    }
    
    response = requests.post(OPENAI_BASE, headers=headers, json=data, timeout=TIMEOUT)
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
        "service": "Blog Agent API",
        "version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/generate")
def generate_blog_post(
    topic: str = Query(..., description="Blog topic"),
    research_data: str = Query("", description="Research data to include"),
    word_count: int = Query(1500, description="Target word count"),
    style: str = Query("Indian Market Copywriter", description="Writing style"),
    token: str = Depends(verify_token)
):
    """Generate a blog post"""
    try:
        result = generate_blog(topic, research_data, word_count, style)
        
        return {
            "topic": topic,
            "word_count": word_count,
            "style": style,
            "content": result["choices"][0]["message"]["content"],
            "source": "OpenAI GPT-4",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cost_usd": 0.80
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blog generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
