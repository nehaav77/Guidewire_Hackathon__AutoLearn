from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "ShieldRide AI-Powered Insurance API"
    SECRET_KEY: str = "changeme"
    
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "shieldride"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # APIs
    OWM_API_KEY: str | None = None
    
    # Integrations
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_WHATSAPP_NUMBER: str | None = None
    RAZORPAY_KEY_ID: str | None = None
    RAZORPAY_KEY_SECRET: str | None = None

    class Config:
        env_file = ".env"

settings = Settings()
