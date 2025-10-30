from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
import requests
import os

app = FastAPI(title="Image Agent API", version="1.0")

# ---------------------------------------------------------------------
# Authentication setup
# ---------------------------------------------------------------------
security = HTTPBearer()
API_KEY = os.getenv("API_KEY", "image-agent-secret-key-2024")

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
OPENAI_BASE = "https://api.openai.com/v1/images/generations"
TIMEOUT = 60

# ---------------------------------------------------------------------
# Image Generation Functions
# ---------------------------------------------------------------------
def generate_images(prompt: str, count: int = 5, size: str = "1024x1024", style: str = "professional"):
    """Generate images using DALL-E API"""
    headers = {
        # "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Enhance prompt for better results
    enhanced_prompt = f"{prompt}, {style} style, high quality, professional, visually appealing"
    
    data = {
        "model": "dall-e-3",
        "prompt": enhanced_prompt,
        "n": min(count, 4),  # DALL-E 3 max is 4 images
        "size": size,
        "quality": "hd",
        "style": "vivid"
    }
    
    response = requests.post(OPENAI_BASE, headers=headers, json=data, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()

def generate_stable_diffusion_images(prompt: str, count: int = 5):
    """Generate images using Stable Diffusion (placeholder for external API)"""
    # This would connect to a Stable Diffusion API service
    # For now, return a mock response
    return {
        "images": [
            {
                "url": f"https://example.com/generated-image-{i}.png",
                "prompt": prompt,
                "model": "stable-diffusion-xl"
            }
            for i in range(count)
        ]
    }

# ---------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------
@app.get("/health")
def health_check():
    """Health check endpoint (no authentication required)"""
    return {
        "status": "healthy",
        "service": "Image Agent API",
        "version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/generate")
def generate_images_endpoint(
    prompt: str = Query(..., description="Image generation prompt"),
    count: int = Query(5, description="Number of images to generate"),
    size: str = Query("1024x1024", description="Image size"),
    style: str = Query("professional", description="Image style"),
    model: str = Query("dalle", description="Model to use (dalle or sd)"),
    token: str = Depends(verify_token)
):
    """Generate images"""
    try:
        if model.lower() == "dalle":
            result = generate_images(prompt, count, size, style)
        else:
            result = generate_stable_diffusion_images(prompt, count)
        
        return {
            "prompt": prompt,
            "count": count,
            "size": size,
            "style": style,
            "model": model,
            "images": result.get("data", result.get("images", [])),
            "source": "DALL-E 3" if model.lower() == "dalle" else "Stable Diffusion",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cost_usd": 0.70
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
