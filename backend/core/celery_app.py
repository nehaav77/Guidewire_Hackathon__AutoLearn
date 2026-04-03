from celery import Celery
from core.config import settings

celery_app = Celery(
    "shieldride_workers",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["services.trigger_engine", "services.fraud_scoring"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
)

# Example scheduled polling (in a real app, we'd use celery beat)
celery_app.conf.beat_schedule = {
    # 'poll-weather-every-15-mins': {
    #     'task': 'services.trigger_engine.poll_weather_data',
    #     'schedule': 900.0,
    # },
}
