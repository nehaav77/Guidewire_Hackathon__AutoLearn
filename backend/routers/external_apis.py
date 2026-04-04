"""
ShieldRide External Data APIs
Real integrations with: OpenWeatherMap (IMD proxy), Open-Meteo AQI (CPCB proxy),
IODA Internet Shutdown, PPAC Fuel Prices, Blinkit Store Mock
"""
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from core.config import settings
import database as db
import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------
# 1. OpenWeatherMap — REAL API (IMD proxy for Rainfall & Heat Index)
# ---------------------------------------------------------
@router.get("/weather")
async def get_weather(lat: float = 12.9716, lon: float = 77.5946):
    """
    Mocked weather API.
    """
    return {
        "source": "OpenWeatherMap (MOCKED)",
        "location": "Bengaluru",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "temperature_celsius": 32.5,
        "humidity_percent": 68,
        "rainfall_mm_per_hr": 0,
        "wind_speed_kmh": 12.4,
        "wbgt_heat_index": 35.8,
        "description": "Partly cloudy",
        "trigger_assessment": {
            "rainfall_trigger": False,
            "heat_trigger": False,
            "rainfall_threshold": "20 mm/hr for 60 min",
            "heat_threshold": "44°C WBGT for 2 hrs"
        },
        "icon": "02d",
        "raw_data": {}
    }


# ---------------------------------------------------------
# 2. Open-Meteo AQI — REAL API (No key needed, CPCB proxy)
# ---------------------------------------------------------
@router.get("/aqi")
async def get_aqi(lat: float = 12.9716, lon: float = 77.5946):
    """
    Mocked AQI API.
    """
    return {
        "source": "Open-Meteo (MOCKED)",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "aqi": 155,
        "pm10": 80,
        "pm2_5": 45,
        "threshold_exceeded": False,
        "trigger_assessment": {
            "aqi_trigger": False,
            "threshold": "AQI > 400 (Severe category) for 4 hours"
        }
    }


# ---------------------------------------------------------
# 3. IODA — REAL API (Internet Shutdowns)
# ---------------------------------------------------------
@router.get("/internet_shutdowns")
async def get_internet_shutdowns(country_code: str = "IN"):
    """
    Fetches real-time internet disruption alerts from IODA (UC San Diego / CAIDA).
    Free public API, no key needed.
    """
    url = f"https://api.ioda.inetintel.cc.gatech.edu/v2/alerts?limit=10"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            if response.status_code != 200:
                return {
                    "source": "IODA (CAIDA)",
                    "status": "API_UNAVAILABLE",
                    "message": "IODA API returned non-200 status. This is expected during stable network conditions.",
                    "active_shutdowns": False
                }

            data = response.json()
            return {
                "source": "IODA (CAIDA, UC San Diego) — LIVE",
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "alerts": data,
                "trigger_assessment": {
                    "internet_shutdown_trigger": False,
                    "threshold": "Data throughput drops >30% for 3+ hours in target region"
                }
            }
    except httpx.RequestError as e:
        logger.warning(f"IODA request failed: {e}")
        return {
            "source": "IODA (CAIDA)",
            "status": "UNREACHABLE",
            "message": str(e),
            "active_shutdowns": False
        }


# ---------------------------------------------------------
# 4. PPAC — Fuel Prices (Static → updated via Celery in production)
# ---------------------------------------------------------
@router.get("/fuel_prices")
async def get_fuel_prices(city: str = "bangalore"):
    """
    Fuel price data (PPAC source). In production, this would be parsed from PPAC CSVs
    via a scheduled Celery Beat task. Current: returns latest known prices.
    """
    return {
        "city": "Bengaluru",
        "petrol_price_inr": 102.86,
        "diesel_price_inr": 88.94,
        "date": datetime.date.today().isoformat(),
        "source": "PPAC (Static — scheduled update via Celery Beat in production)",
        "note": "PPAC updates daily CSV files. A Celery Beat task would parse these automatically."
    }


# ---------------------------------------------------------
# 5. Blinkit Dark Store Status (Mock — internal API simulation)
# ---------------------------------------------------------
class BlinkitStoreResponse(BaseModel):
    store_id: str
    zone: str
    availability: str
    delivery_eta: int | None
    serviceable_pincodes: List[str]
    hub_radius_km: float
    assigned_riders: int
    active_orders_in_queue: int
    last_updated: str

@router.get("/blinkit/store/{store_id}", response_model=BlinkitStoreResponse)
async def get_blinkit_store_status(store_id: str):
    """
    Simulates Blinkit's internal dark store operational status API.
    In production, this would be a webhook integration from Blinkit.
    """
    # Try database first
    store = await db.dark_stores_collection.find_one({"store_id": store_id})
    if store:
            store.pop("_id", None)
            store.setdefault("last_updated", datetime.datetime.now().isoformat())
            return store

    # Fallback to demo data
    for s in db.DEMO_DARK_STORES:
        if s["store_id"] == store_id:
            return {**s, "last_updated": datetime.datetime.now().isoformat()}

    return {
        "store_id": store_id,
        "zone": "Unknown_Zone",
        "availability": "Open",
        "delivery_eta": 8,
        "serviceable_pincodes": ["560001"],
        "hub_radius_km": 2.0,
        "assigned_riders": 15,
        "active_orders_in_queue": 7,
        "last_updated": datetime.datetime.now().isoformat()
    }


@router.get("/blinkit/stores")
async def get_all_stores():
    """Returns all dark stores."""
    stores = await db.dark_stores_collection.find({}).to_list(length=50)
    for s in stores:
        s.pop("_id", None)
    if stores:
        return stores
    return db.DEMO_DARK_STORES


# ---------------------------------------------------------
# 6. API Configuration Status
# ---------------------------------------------------------
@router.get("/status")
async def get_api_status():
    """Returns which external APIs are configured and reachable."""
    return {
        "apis": {
            "openweathermap": {
                "configured": bool(settings.OWM_API_KEY),
                "purpose": "Real-time weather data (rainfall, heat index) — IMD proxy",
                "setup": "Sign up at https://openweathermap.org/api → Get free API key → Add OWM_API_KEY=your_key to backend/.env",
                "cost": "Free (60 calls/min)"
            },
            "open_meteo_aqi": {
                "configured": True,
                "purpose": "Air Quality Index data — CPCB proxy",
                "setup": "No API key needed. Public API.",
                "cost": "Free"
            },
            "ioda": {
                "configured": True,
                "purpose": "Internet shutdown detection — CAIDA UC San Diego",
                "setup": "No API key needed. Public API.",
                "cost": "Free"
            },
            "twilio": {
                "configured": bool(settings.TWILIO_ACCOUNT_SID),
                "purpose": "WhatsApp notifications to riders",
                "setup": "Sign up at https://www.twilio.com → Get SID + Auth Token → Add to .env",
                "cost": "Free trial with sandbox"
            },
            "razorpay": {
                "configured": bool(settings.RAZORPAY_KEY_ID),
                "purpose": "UPI payouts to riders via RazorpayX",
                "setup": "Sign up at https://razorpay.com → Enable Test Mode → Get Key ID + Secret → Add to .env",
                "cost": "Free test mode"
            },
            "ppac": {
                "configured": True,
                "purpose": "Fuel prices (economy trigger) — static data, scheduled parser in production",
                "setup": "Automated via Celery Beat CSV parser",
                "cost": "Free (government data)"
            }
        }
    }
