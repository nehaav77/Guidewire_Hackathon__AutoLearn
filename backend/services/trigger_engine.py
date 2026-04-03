import httpx
import logging
from celery import shared_task
from core.celery_app import celery_app
from core.config import settings
import datetime

logger = logging.getLogger(__name__)

@shared_task
def poll_weather_data(lat: float = 12.9716, lon: float = 77.5946, zone_pincode: str = "560034"):
    """
    Celery task that polls OpenWeatherMap for rainfall intensity.
    If rainfall > 20mm/hr, it should ideally increment a duration timer.
    In MVP, we create a TriggerEvent immediately if it's over threshold.
    """
    if not settings.OWM_API_KEY:
        logger.error("OWM_API_KEY missing - skipping weather trigger polling")
        return False
        
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={settings.OWM_API_KEY}&units=metric"
    try:
        response = httpx.get(url) # Using sync httpx for Celery worker compatibility
        if response.status_code == 200:
            data = response.json()
            rain_1h = data.get("rain", {}).get("1h", 0)
            heat_index_celsius = data.get("main", {}).get("temp", 0) # Simplified WBGT logic
            
            # Evaluate Threshold 1: Extreme Rainfall (> 20mm/hr)
            if rain_1h >= 20.0:
                logger.warning(f"THRESHOLD MET: Rainfall {rain_1h}mm/hr detected at {zone_pincode}")
                # We would call initiate_trigger_event("RAINFALL", rain_1h, zone_pincode) here
                return {"triggered": True, "type": "RAINFALL", "value": rain_1h}
                
            # Evaluate Threshold 2: Extreme Heat Index (> 44C)
            if heat_index_celsius >= 44.0:
                logger.warning(f"THRESHOLD MET: Heat Index {heat_index_celsius}C detected at {zone_pincode}")
                return {"triggered": True, "type": "HEAT_INDEX", "value": heat_index_celsius}
                
        return {"triggered": False}
    except Exception as e:
        logger.error(f"Weather Polling Error: {str(e)}")
        return False

@shared_task
def process_manual_trigger(trigger_type: str, intensity: float, affected_store_ids: list):
    """
    Simulates a trigger event confirmation (e.g. 60 minute duration met).
    This begins the Zero-Touch Claim execution pipeline.
    """
    logger.info(f"Trigger {trigger_type} activated with intensity {intensity} for stores {affected_store_ids}")
    # 1. Query Mongo for all riders assigned to these stores with active policies
    # 2. Map through Fraud Scoring
    # 3. Create Claims
    # (Implementation details exist in Domain logic - this is the entry hook)
    
    return f"Triggered {len(affected_store_ids)} stores"
