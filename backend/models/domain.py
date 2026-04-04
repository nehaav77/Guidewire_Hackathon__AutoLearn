from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid


# ─── Rider Models ───

class RiderCreate(BaseModel):
    mobile_number: str
    assigned_store_id: str
    name: Optional[str] = None

class Rider(BaseModel):
    rider_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mobile_number: str
    assigned_store_id: str
    name: Optional[str] = None
    upi_id: Optional[str] = None
    tenure_months: int = 0
    language_preference: str = "en"
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ─── Policy Models ───

class PolicyCreate(BaseModel):
    rider_id: str
    coverage_tier: str  # BASIC, STANDARD, PREMIUM
    daily_coverage: float
    weekly_premium: float
    store_id: Optional[str] = None

class Policy(BaseModel):
    policy_id: str = Field(default_factory=lambda: f"POL-{str(uuid.uuid4())[:8].upper()}")
    rider_id: str
    coverage_tier: str
    daily_coverage: float
    weekly_premium: float
    status: str = "ACTIVE"  # ACTIVE, LAPSED, UPGRADED
    valid_from: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    valid_until: str = Field(default_factory=lambda: (datetime.utcnow() + timedelta(days=7)).isoformat())
    auto_renew: bool = True
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ─── Claim Models ───

class Claim(BaseModel):
    claim_id: str = Field(default_factory=lambda: f"SHR-{datetime.utcnow().strftime('%Y')}-{str(uuid.uuid4())[:5].upper()}")
    rider_id: str
    event_id: str
    trigger_type: str = "RAINFALL"
    payout_amount: float
    resolution: str  # PENDING, AUTO-APPROVE, SOFT_HOLD, HARD_HOLD
    fraud_score: float
    payout_status: str  # PENDING, PROCESSING, CREDITED
    store_id: Optional[str] = None
    zone: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ─── Trigger Event Models ───

class TriggerEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: f"EVT-{str(uuid.uuid4())[:8].upper()}")
    trigger_type: str  # RAINFALL, HEAT_INDEX, AQI, PLATFORM_DOWNTIME, INTERNET_SHUTDOWN
    intensity_value: float
    intensity_unit: str = ""
    affected_store_ids: List[str]
    affected_zones: List[str] = []
    duration_minutes: int = 60
    data_source_ref: str = ""
    status: str = "ACTIVE"  # ACTIVE, RESOLVED, EXPIRED
    payout_tier: str = ""  # e.g. "30%", "60%", "100%"
    claims_generated: int = 0
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ─── Dark Store Model ───

class DarkStore(BaseModel):
    store_id: str
    zone: str
    availability: str  # Open, Closed
    delivery_eta: Optional[int] = None
    serviceable_pincodes: List[str]
    hub_radius_km: float
    assigned_riders: int
    active_orders_in_queue: int
    infrastructure: str = "ground_floor"
    last_updated: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ─── Auth Models ───

class LoginRequest(BaseModel):
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: str = "rider"  # rider or insurer

class LoginResponse(BaseModel):
    success: bool
    role: str
    user_id: str
    token: str
    name: str
    message: str = ""


# ─── Premium Calculation Request ───

class PremiumRequest(BaseModel):
    store_id: str = "BLK-BLR-047"
    tenure_months: int = 0
    coverage_tier: str = "STANDARD"
    month: Optional[int] = None
    is_basement: bool = False


# ─── Trigger Simulation Request ───

class TriggerSimulateRequest(BaseModel):
    trigger_type: str = "RAINFALL"
    intensity: float = 28.0
    store_ids: List[str] = ["BLK-BLR-047"]
    duration_minutes: int = 60


# ─── Insurer Statistics Response ───

class InsurerStats(BaseModel):
    claims_paid_total: float
    premiums_collected: float
    loss_ratio: float
    active_policies: int
    new_policies_this_week: int
    lapsed_policies: int
    net_growth: int
    retention_rate: float
    avg_weekly_benefit: float
    avg_weekly_premium: float
    avg_net_benefit: float
    triggers_fired_today: int
    auto_approve_rate: float
    fraud_prevented_amount: float
    reserve_recommended: float
    reserve_current: float

# ─── Location & Nearest Hub Models ───

class LocationRequest(BaseModel):
    latitude: float
    longitude: float

class NearestHubResponse(BaseModel):
    store_id: str
    zone: str
    distance_km: float
    availability: str
