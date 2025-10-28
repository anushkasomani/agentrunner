from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
import requests
import os

app = FastAPI(title="Script Agent API", version="1.0")

# ---------------------------------------------------------------------
# Authentication setup
# ---------------------------------------------------------------------
security = HTTPBearer()
API_KEY = os.getenv("API_KEY", "script-agent-secret-key-2024")

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
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "your-google-api-key")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent"
TIMEOUT = 60

# ---------------------------------------------------------------------
# Script Generation Functions
# ---------------------------------------------------------------------
def generate_video_script(topic: str, duration: int = 60, style: str = "educational", research_data: str = ""):
    """Generate video script using Gemini API"""
    headers = {
        "Content-Type": "application/json"
    }
    
    system_prompt = f"""You are an expert video scriptwriter specializing in {style} content. 
    Create engaging, well-structured video scripts that are:
    - Hook-driven with strong opening
    - Clear narrative structure
    - Visually descriptive
    - Include scene breakdowns
    - Specify camera angles and transitions
    - End with strong call-to-action
    
    Format with clear scene descriptions and timing."""
    
    user_prompt = f"""Create a {duration}-second video script about: {topic}
    
    {f"Use this research data: {research_data}" if research_data else ""}
    
    Style: {style}
    Duration: {duration} seconds
    
    Include:
    - Hook (first 5 seconds)
    - Main content with scene breakdowns
    - Visual cues and camera directions
    - Call-to-action ending
    - Estimated timing for each section"""
    
    data = {
        "contents": [
            {
                "parts": [
                    {"text": f"{system_prompt}\n\n{user_prompt}"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 2000
        }
    }
    
    url = f"{GEMINI_BASE}?key={GOOGLE_API_KEY}"
    response = requests.post(url, headers=headers, json=data, timeout=TIMEOUT)
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
        "service": "Script Agent API",
        "version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/generate")
def generate_script(
    topic: str = Query(..., description="Video script topic"),
    duration: int = Query(60, description="Video duration in seconds"),
    style: str = Query("educational", description="Script style"),
    research_data: str = Query("", description="Research data to include"),
    token: str = Depends(verify_token)
):
    """Generate a video script"""
    try:
        result = generate_video_script(topic, duration, style, research_data)
        
        script_content = result["candidates"][0]["content"]["parts"][0]["text"]
        
        return {
            "topic": topic,
            "duration": duration,
            "style": style,
            "script": script_content,
            "source": "Gemini 1.5 Pro",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cost_usd": 0.30
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Script generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
