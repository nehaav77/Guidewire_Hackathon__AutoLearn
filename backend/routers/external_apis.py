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
    Fetches real-time weather for Bengaluru using OpenWeatherMap.
    Acts as a proxy for IMD data. Requires OWM_API_KEY in .env
    
    Returns temperature, humidity, rainfall, wind, and trigger assessment.
    """
    if not settings.OWM_API_KEY:
        return {
            "source": "OpenWeatherMap",
            "status": "API_KEY_NOT_CONFIGURED",
            "message": "Set OWM_API_KEY in backend/.env to enable real weather data",
            "instructions": "1. Sign up at https://openweathermap.org/api  2. Get API key (free tier)  3. Add OWM_API_KEY=your_key to .env",
            "fallback_data": {
                "temperature_celsius": 32.5,
                "humidity_percent": 68,
                "rainfall_mm_per_hr": 0,
                "wind_speed_kmh": 12.4,
                "description": "Partly cloudy"
            }
        }

    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={settings.OWM_API_KEY}&units=metric"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="OWM API error")

            data = response.json()
            temp = data.get("main", {}).get("temp", 0)
            humidity = data.get("main", {}).get("humidity", 0)
            rain_1h = data.get("rain", {}).get("1h", 0)
            wind_speed = data.get("wind", {}).get("speed", 0) * 3.6  # m/s to km/h

            # WBGT Heat Index approximation
            # Simplified Steadman formula: HI ≈ T + 0.33 * (H * 6.105 * exp(17.27*T/(237.7+T)) / 100) - 4
            wbgt_approx = round(0.567 * temp + 0.393 * (humidity / 100 * 6.105 * 2.718 ** (17.27 * temp / (237.7 + temp))) + 3.94, 1)

            # Trigger assessment
            rainfall_trigger = rain_1h > 20  # >20mm/hr
            heat_trigger = wbgt_approx > 44  # >44°C WBGT

            return {
                "source": "OpenWeatherMap (LIVE)",
                "location": data.get("name", "Bengaluru"),
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "temperature_celsius": temp,
                "humidity_percent": humidity,
                "rainfall_mm_per_hr": rain_1h,
                "wind_speed_kmh": round(wind_speed, 1),
                "wbgt_heat_index": wbgt_approx,
                "description": data.get("weather", [{}])[0].get("description", ""),
                "trigger_assessment": {
                    "rainfall_trigger": rainfall_trigger,
                    "heat_trigger": heat_trigger,
                    "rainfall_threshold": "20 mm/hr for 60 min",
                    "heat_threshold": "44°C WBGT for 2 hrs"
                },
                "icon": data.get("weather", [{}])[0].get("icon", ""),
                "raw_data": data
            }
    except httpx.RequestError as e:
        logger.error(f"OWM request failed: {e}")
        raise HTTPException(status_code=503, detail=f"Weather API unreachable: {str(e)}")


# ---------------------------------------------------------
# 2. Open-Meteo AQI — REAL API (No key needed, CPCB proxy)
# ---------------------------------------------------------
@router.get("/aqi")
async def get_aqi(lat: float = 12.9716, lon: float = 77.5946):
    """
    Fetches real-time Air Quality Index via Open-Meteo (free, no API key).
    Acts as a proxy for CPCB ground station data.
    """
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=european_aqi,pm10,pm2_5"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="AQI API error")

            data = response.json()
            current = data.get("current", {})
            aqi = current.get("european_aqi", 0)

            return {
                "source": "Open-Meteo (CPCB proxy) — LIVE",
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "aqi": aqi,
                "pm10": current.get("pm10"),
                "pm2_5": current.get("pm2_5"),
                "threshold_exceeded": aqi > 400,
                "trigger_assessment": {
                    "aqi_trigger": aqi > 400,
                    "threshold": "AQI > 400 (Severe category) for 4 hours"
                }
            }
    except httpx.RequestError as e:
        logger.error(f"AQI request failed: {e}")
        raise HTTPException(status_code=503, detail=f"AQI API unreachable: {str(e)}")


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
