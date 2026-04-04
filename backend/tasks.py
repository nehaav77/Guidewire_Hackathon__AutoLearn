from celery_app import celery_app
import asyncio
import httpx
from core.config import settings
import logging

logger = logging.getLogger(__name__)

async def fetch_weather_internal():
    temp = 32.5
    humidity = 68
    rain_1h = 0
    wbgt_approx = 35.8
    logger.info(f"Weather Polled (MOCKED): Temp={temp}C, Humidity={humidity}%, Rain={rain_1h}mm, WBGT={wbgt_approx}C")
    # Trigger evaluation could be added here

async def fetch_aqi_internal():
    aqi = 155
    logger.info(f"AQI Polled (MOCKED): {aqi}")
    # Trigger evaluation could be added here

@celery_app.task
def poll_weather_data():
    """Celery task to poll weather data"""
    asyncio.run(fetch_weather_internal())

@celery_app.task
def poll_aqi_data():
    """Celery task to poll AQI data"""
    asyncio.run(fetch_aqi_internal())
