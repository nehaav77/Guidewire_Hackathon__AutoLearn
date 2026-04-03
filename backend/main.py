"""
ShieldRide Main Application
FastAPI entry point with MongoDB startup/shutdown lifecycle
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.config import settings
from database import verify_db_connection, seed_dark_stores
import routers.external_apis
import routers.riders
import routers.claims
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle for MongoDB verification."""
    # Startup
    db_ok = await verify_db_connection()
    if db_ok:
        await seed_dark_stores()
        logger.info("🚀 ShieldRide API started with MongoDB connected")
    else:
        logger.warning("⚠️ ShieldRide API started WITHOUT MongoDB — using in-memory fallback")
    
    yield
    
    # Shutdown
    logger.info("ShieldRide API shutting down")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="ShieldRide — AI-Powered Parametric Income Protection for Blinkit Delivery Partners. "
                "Implements zero-touch claims, dynamic pricing, 6-signal fraud detection, and automated triggers.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS config — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    routers.riders.router, 
    prefix=settings.API_V1_STR + "/riders", 
    tags=["Auth & Riders"]
)
app.include_router(
    routers.claims.router, 
    prefix=settings.API_V1_STR + "/claims", 
    tags=["Claims & Triggers"]
)
app.include_router(
    routers.external_apis.router, 
    prefix=settings.API_V1_STR + "/external", 
    tags=["External Data APIs"]
)


@app.get("/", tags=["Health"])
def read_root():
    return {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "version": "2.0.0",
        "phase": "Phase 2 — Automation & Protection",
        "endpoints": {
            "docs": "/docs",
            "riders_signup": f"{settings.API_V1_STR}/riders/signup",
            "riders_signin": f"{settings.API_V1_STR}/riders/signin",
            "insurer_login": f"{settings.API_V1_STR}/riders/login",
            "calculate_premium": f"{settings.API_V1_STR}/riders/calculate-premium",
            "simulate_trigger": f"{settings.API_V1_STR}/claims/simulate-trigger",
            "insurer_stats": f"{settings.API_V1_STR}/claims/insurer/stats",
            "weather": f"{settings.API_V1_STR}/external/weather",
            "aqi": f"{settings.API_V1_STR}/external/aqi",
        }
    }


@app.get("/health", tags=["Health"])
async def health_check():
    db_ok = await verify_db_connection()
    return {
        "status": "healthy",
        "database": "connected" if db_ok else "disconnected",
        "owm_api": "configured" if settings.OWM_API_KEY else "not_configured",
        "twilio": "configured" if settings.TWILIO_ACCOUNT_SID else "not_configured",
        "razorpay": "configured" if settings.RAZORPAY_KEY_ID else "not_configured",
    }
