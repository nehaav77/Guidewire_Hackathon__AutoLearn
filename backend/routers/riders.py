"""
ShieldRide Riders & Auth Router
- Separate signup & signin for riders
- Insurer login endpoint
- All data stored in MongoDB (or in-memory fallback)
- Policy management with dynamic pricing
"""
from fastapi import APIRouter, HTTPException
from models.domain import (
    RiderCreate, Rider, PolicyCreate, Policy,
    LoginRequest, LoginResponse, PremiumRequest
)
import database as db
from services.pricing_engine import calculate_premium, get_all_zones, COVERAGE_TIERS
import uuid
import datetime

router = APIRouter()


# ═══════════════════════════════════════════════
# RIDER SIGNUP (New rider registration)
# ═══════════════════════════════════════════════

@router.post("/signup")
async def rider_signup(data: RiderCreate):
    """
    Register a new rider. Stores data in MongoDB (or in-memory) immediately.
    Requires: name, mobile_number, assigned_store_id
    """
    if not data.mobile_number or len(data.mobile_number) < 10:
        raise HTTPException(status_code=400, detail="Valid 10-digit mobile number required")
    if not data.name or len(data.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name is required (minimum 2 characters)")

    # Check if rider already exists
    existing = await db.riders_collection.find_one({"mobile_number": data.mobile_number})
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A rider with this mobile number already exists. Please sign in instead."
        )

    # Create new rider
    new_rider = Rider(
        mobile_number=data.mobile_number,
        assigned_store_id=data.assigned_store_id,
        name=data.name.strip(),
        upi_id=f"{data.mobile_number}@paytm"
    )
    rider_dict = new_rider.dict()

    # Store in database
    try:
        await db.riders_collection.insert_one(rider_dict.copy())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "success": True,
        "message": "Rider registered successfully!",
        "rider_id": new_rider.rider_id,
        "name": new_rider.name,
        "mobile_number": new_rider.mobile_number,
        "assigned_store_id": new_rider.assigned_store_id
    }


# ═══════════════════════════════════════════════
# RIDER SIGNIN (Existing rider login)
# ═══════════════════════════════════════════════

@router.post("/signin")
async def rider_signin(data: LoginRequest):
    """
    Sign in an existing rider by mobile number.
    Returns rider data if found, 404 if not registered.
    """
    mobile = data.mobile_number
    if not mobile or len(mobile) < 10:
        raise HTTPException(status_code=400, detail="Valid mobile number required")

    rider = await db.riders_collection.find_one({"mobile_number": mobile})

    if not rider:
        raise HTTPException(
            status_code=404,
            detail="No rider found with this mobile number. Please sign up first."
        )

    rider.pop("_id", None)

    # Check for active policy
    policy = await db.policies_collection.find_one(
        {"rider_id": rider["rider_id"], "status": "ACTIVE"}
    )
    if policy:
        policy.pop("_id", None)

    return {
        "success": True,
        "message": f"Welcome back, {rider.get('name', 'Rider')}!",
        "rider_id": rider["rider_id"],
        "name": rider.get("name", ""),
        "mobile_number": rider["mobile_number"],
        "assigned_store_id": rider.get("assigned_store_id", ""),
        "has_active_policy": policy is not None,
        "active_policy": policy
    }


# ═══════════════════════════════════════════════
# INSURER LOGIN
# ═══════════════════════════════════════════════

@router.post("/login", response_model=LoginResponse)
async def insurer_login(request: LoginRequest):
    """Insurer login with email + password."""
    if request.role != "insurer":
        raise HTTPException(status_code=400, detail="Use /signup or /signin for riders")

    if request.email == db.DEMO_INSURER["email"] and request.password == db.DEMO_INSURER["password"]:
        return LoginResponse(
            success=True,
            role="insurer",
            user_id="insurer-admin-001",
            token=f"ins_{uuid.uuid4().hex[:16]}",
            name=db.DEMO_INSURER["name"],
            message="Welcome to ShieldRide Operations"
        )
    raise HTTPException(status_code=401, detail="Invalid insurer credentials")


# ═══════════════════════════════════════════════
# ONBOARDING — Update rider's store after selection
# ═══════════════════════════════════════════════

@router.post("/onboard")
async def onboard_rider(rider_data: RiderCreate):
    """
    Onboarding step: Updates the rider's assigned store.
    Called after signup when rider confirms their dark store.
    """
    rider = await db.riders_collection.find_one({"mobile_number": rider_data.mobile_number})

    if rider:
        await db.riders_collection.update_one(
            {"mobile_number": rider_data.mobile_number},
            {"$set": {
                "assigned_store_id": rider_data.assigned_store_id,
                "name": rider_data.name or rider.get("name", "")
            }}
        )
        rider.pop("_id", None)
        rider["assigned_store_id"] = rider_data.assigned_store_id
        return rider

    # If rider doesn't exist yet (edge case), create them
    new_rider = Rider(
        mobile_number=rider_data.mobile_number,
        assigned_store_id=rider_data.assigned_store_id,
        name=rider_data.name or f"Rider {rider_data.mobile_number[-4:]}",
        upi_id=f"{rider_data.mobile_number}@paytm"
    )
    rider_dict = new_rider.dict()
    await db.riders_collection.insert_one(rider_dict.copy())
    return rider_dict


# ═══════════════════════════════════════════════
# POLICY CREATION
# ═══════════════════════════════════════════════

@router.post("/policy")
async def create_policy(policy_data: PolicyCreate):
    """Creates a parametric insurance policy and stores in database."""
    new_policy = Policy(**policy_data.dict())
    policy_dict = new_policy.dict()

    try:
        await db.policies_collection.insert_one(policy_dict.copy())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return policy_dict


# ═══════════════════════════════════════════════
# DYNAMIC PRICING
# ═══════════════════════════════════════════════

@router.post("/calculate-premium")
async def calculate_premium_endpoint(request: PremiumRequest):
    """
    Dynamic pricing: Weekly Premium = Base × ZRM × WTF × SI × CTM
    """
    return calculate_premium(
        store_id=request.store_id,
        tenure_months=request.tenure_months,
        coverage_tier=request.coverage_tier,
        month=request.month,
        is_basement=request.is_basement
    )


@router.get("/pricing/zones")
async def get_pricing_zones():
    """Returns all dark store zones with risk multipliers."""
    return {"zones": get_all_zones(), "coverage_tiers": COVERAGE_TIERS}


# ═══════════════════════════════════════════════
# RIDER STATUS & POLICY DETAILS
# ═══════════════════════════════════════════════

@router.get("/{rider_id}/status")
async def get_rider_status(rider_id: str):
    """Full rider status with active policy."""
    rider = await db.riders_collection.find_one({"rider_id": rider_id})

    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    rider.pop("_id", None)

    policy = await db.policies_collection.find_one({"rider_id": rider_id, "status": "ACTIVE"})
    if policy:
        policy.pop("_id", None)

    return {"rider": rider, "active_policy": policy}


@router.get("/{rider_id}/policy")
async def get_rider_policy_details(rider_id: str):
    """Full policy details with pricing breakdown for all tiers."""
    rider = await db.riders_collection.find_one({"rider_id": rider_id})

    store_id = rider.get("assigned_store_id", "BLK-BLR-047") if rider else "BLK-BLR-047"
    tenure = rider.get("tenure_months", 0) if rider else 0

    tiers_pricing = {}
    for tier_name in ["BASIC", "STANDARD", "PREMIUM"]:
        tiers_pricing[tier_name] = calculate_premium(
            store_id=store_id, tenure_months=tenure, coverage_tier=tier_name
        )

    return {
        "rider_id": rider_id,
        "store_id": store_id,
        "tenure_months": tenure,
        "tiers": tiers_pricing
    }
