from celery import Celery
from core.config import settings
import logging

logger = logging.getLogger(__name__)

celery_app = Celery(
    "shieldride",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    # Configure beat schedule if needed
    beat_schedule={
        'poll-weather-data-every-15-mins': {
            'task': 'tasks.poll_weather_data',
            'schedule': 900.0, # seconds
        },
        'poll-aqi-data-every-30-mins': {
            'task': 'tasks.poll_aqi_data',
            'schedule': 1800.0, # seconds
        },
    }
)
