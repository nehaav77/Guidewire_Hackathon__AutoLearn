"""
ShieldRide Claims Router
Handles: Zero-touch claim execution, claim history, weekly summaries, insurer stats.
All claims stored in MongoDB (or in-memory fallback).
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from models.domain import Claim, TriggerEvent, TriggerSimulateRequest
import database as db
from services.fraud_scoring import score_rider_claim, detect_ring_fraud
from services.integrations import initiate_upi_payout, notify_rider_whatsapp
from services.pricing_engine import ZONE_RISK_TABLE
import datetime
import uuid
import random
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════
# TRIGGER SIMULATION & EXECUTION
# ═══════════════════════════════════════════════

@router.post("/simulate-trigger")
async def simulate_trigger(request: TriggerSimulateRequest, background_tasks: BackgroundTasks):
    """
    Simulates a trigger event and executes the full zero-touch claim pipeline.
    Stores all events and claims in the database.
    """
    trigger_type = request.trigger_type.upper()
    payout_percentage = _calculate_payout_tier(trigger_type, request.intensity, request.duration_minutes)

    affected_zones = []
    for sid in request.store_ids:
        zone_data = ZONE_RISK_TABLE.get(sid, {})
        if zone_data:
            affected_zones.append(zone_data.get("zone", "Unknown"))

    event = TriggerEvent(
        trigger_type=trigger_type,
        intensity_value=request.intensity,
        intensity_unit=_get_intensity_unit(trigger_type),
        affected_store_ids=request.store_ids,
        affected_zones=affected_zones,
        duration_minutes=request.duration_minutes,
        data_source_ref=_get_data_source(trigger_type),
        payout_tier=f"{int(payout_percentage * 100)}%"
    )
    event_dict = event.dict()

    # Store event
    try:
        await db.events_collection.insert_one(event_dict.copy())
    except Exception as e:
        logger.warning(f"Failed to store event: {e}")

    # Fetch real riders from database
    real_riders = []
    for store_id in request.store_ids:
        cursor = db.riders_collection.find({"assigned_store_id": store_id})
        real_riders.extend(await cursor.to_list(length=50))

    # Process claims for each affected store
    all_claims = []
    for store_id in request.store_ids:
        store_data = next((s for s in db.DEMO_DARK_STORES if s["store_id"] == store_id), None)
        if not store_data:
            continue

        # Use real riders if available, else generate demo
        store_riders = [r for r in real_riders if r.get("assigned_store_id") == store_id]
        if not store_riders:
            num_riders = random.randint(3, min(8, store_data.get("assigned_riders", 12)))
            store_riders = [
                {"rider_id": f"rdr-{uuid.uuid4().hex[:6]}",
                 "name": random.choice(["Ravi K.", "Suresh M.", "Ganesh R.", "Kumar P.", "Anil S.",
                     "Mohan V.", "Deepak L.", "Sanjay T.", "Vijay N.", "Ashok B."])}
                for _ in range(num_riders)
            ]

        for rider in store_riders:
            rider_id = rider.get("rider_id", f"rdr-{uuid.uuid4().hex[:6]}")
            rider_name = rider.get("name", "Unknown Rider")

            fraud_result = score_rider_claim(rider_id, trigger_type, {})
            resolution = fraud_result["resolution"]

            daily_coverage = random.choice([150, 250, 250, 250, 400])
            base_payout = daily_coverage * payout_percentage

            if resolution == "SOFT_HOLD":
                actual_payout = base_payout * 0.5
            elif resolution == "HARD_HOLD":
                actual_payout = 0
            else:
                actual_payout = base_payout

            claim = Claim(
                rider_id=rider_id, event_id=event.event_id, trigger_type=trigger_type,
                payout_amount=round(actual_payout, 2), resolution=resolution,
                fraud_score=fraud_result["composite_score"],
                payout_status="CREDITED" if resolution == "AUTO-APPROVE" else (
                    "PROCESSING" if resolution == "SOFT_HOLD" else "PENDING_REVIEW"
                ),
                store_id=store_id, zone=store_data.get("zone", "Unknown")
            )

            claim_dict = claim.dict()
            claim_dict["rider_name"] = rider_name
            claim_dict["daily_coverage"] = daily_coverage
            claim_dict["fraud_breakdown"] = fraud_result["signal_breakdown"]

            try:
                await db.claims_collection.insert_one(claim_dict.copy())
            except Exception as e:
                logger.warning(f"Failed to store claim: {e}")

            all_claims.append(claim_dict)

    ring_result = detect_ring_fraud(
        store_id=request.store_ids[0],
        claims_in_batch=len(all_claims), assigned_riders=12
    )
    event_dict["claims_generated"] = len(all_claims)

    return {
        "event": event_dict, "claims": all_claims, "ring_detection": ring_result,
        "pipeline_summary": {
            "total_claims": len(all_claims),
            "auto_approved": sum(1 for c in all_claims if c["resolution"] == "AUTO-APPROVE"),
            "soft_holds": sum(1 for c in all_claims if c["resolution"] == "SOFT_HOLD"),
            "hard_holds": sum(1 for c in all_claims if c["resolution"] == "HARD_HOLD"),
            "total_payout": sum(c["payout_amount"] for c in all_claims),
            "pipeline_time_seconds": random.randint(84, 120)
        }
    }


# ═══════════════════════════════════════════════
# CLAIMS HISTORY & QUERIES
# ═══════════════════════════════════════════════

@router.get("/history/{rider_id}")
async def rider_claims_history(rider_id: str):
    """Returns claim history for a specific rider."""
    rider_claims = []
    try:
        cursor = db.claims_collection.find({"rider_id": rider_id}).sort("created_at", -1).limit(50)
        db_claims = await cursor.to_list(length=50)
        rider_claims = [{k: v for k, v in c.items() if k != "_id"} for c in db_claims]
    except Exception as e:
        logger.warning(f"Failed to query claims: {e}")

    if not rider_claims:
        rider_claims = _generate_demo_claims(rider_id)

    return rider_claims


@router.get("/weekly-summary/{rider_id}")
async def weekly_summary(rider_id: str):
    """Returns this week's protection summary."""
    claims = await rider_claims_history(rider_id)
    total_protected = sum(c.get("payout_amount", 0) for c in claims if c.get("payout_status") == "CREDITED")
    weekly_premium = 63

    return {
        "rider_id": rider_id,
        "week_start": (datetime.datetime.utcnow() - datetime.timedelta(days=datetime.datetime.utcnow().weekday())).strftime("%B %d"),
        "week_end": (datetime.datetime.utcnow() + datetime.timedelta(days=6 - datetime.datetime.utcnow().weekday())).strftime("%B %d, %Y"),
        "events": claims[:5],
        "total_protected": round(total_protected, 2),
        "weekly_premium": weekly_premium,
        "net_benefit": round(total_protected - weekly_premium, 2),
        "claims_count": len(claims),
        "active_triggers_today": random.randint(0, 3)
    }


# ═══════════════════════════════════════════════
# INSURER STATISTICS
# ═══════════════════════════════════════════════

@router.get("/insurer/stats")
async def get_insurer_stats():
    """Aggregated statistics for the insurer dashboard."""
    total_claims_value = 84200
    total_policies = 2847

    try:
        pipeline = [{"$group": {"_id": None, "total": {"$sum": "$payout_amount"}, "count": {"$sum": 1}}}]
        result = await db.claims_collection.aggregate(pipeline).to_list(length=1)
        if result and result[0].get("total", 0) > 0:
            total_claims_value = result[0]["total"]
    except Exception:
        pass

    try:
        ct = await db.policies_collection.count_documents({"status": "ACTIVE"})
        if ct > 0:
            total_policies = ct
    except Exception:
        pass

    total_premiums = 126000
    loss_ratio = round((total_claims_value / total_premiums) * 100, 1) if total_premiums > 0 else 66.8

    return {
        "claims_paid_total": total_claims_value,
        "premiums_collected": total_premiums,
        "loss_ratio": loss_ratio,
        "active_policies": total_policies,
        "new_policies_this_week": 142,
        "lapsed_policies": 38,
        "net_growth": 104,
        "retention_rate": 92.4,
        "avg_weekly_benefit": 187,
        "avg_weekly_premium": 71,
        "avg_net_benefit": 116,
        "triggers_fired_today": 42,
        "auto_approve_rate": 84.2,
        "fraud_prevented_amount": 12500,
        "reserve_recommended": 74200,
        "reserve_current": 112000,
        "zone_reserves": [
            {"zone": "Koramangala", "store_id": "BLK-BLR-047", "rainfall_prob": 73, "predicted_claims": "8-14", "reserve": 18400, "risk_color": "#f59e0b"},
            {"zone": "Bellandur", "store_id": "BLK-BLR-061", "rainfall_prob": 81, "predicted_claims": "12-20", "reserve": 28000, "risk_color": "#ef4444"},
            {"zone": "Whitefield", "store_id": "BLK-BLR-089", "rainfall_prob": 22, "predicted_claims": "1-3", "reserve": 4200, "risk_color": "#64748b"},
            {"zone": "Indiranagar", "store_id": "BLK-BLR-033", "rainfall_prob": 45, "predicted_claims": "4-7", "reserve": 9800, "risk_color": "#3b82f6"},
            {"zone": "HSR Layout", "store_id": "BLK-BLR-092", "rainfall_prob": 58, "predicted_claims": "6-10", "reserve": 13800, "risk_color": "#f59e0b"},
        ]
    }


@router.get("/triggers/active")
async def get_active_triggers():
    """Returns currently active trigger events."""
    active = []
    try:
        cursor = db.events_collection.find({"status": "ACTIVE"}).sort("created_at", -1).limit(10)
        active = await cursor.to_list(length=10)
        active = [{k: v for k, v in e.items() if k != "_id"} for e in active]
    except Exception:
        pass

    if not active:
        return [{
            "event_id": "EVT-DEMO-001", "trigger_type": "RAINFALL",
            "intensity_value": 28.5, "intensity_unit": "mm/hr",
            "affected_zones": ["Koramangala 4th Block"],
            "duration_minutes": 75, "status": "ACTIVE", "claims_generated": 8,
            "created_at": datetime.datetime.utcnow().isoformat()
        }]
    return active


# ═══════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════

def _calculate_payout_tier(trigger_type: str, intensity: float, duration: int) -> float:
    if trigger_type == "RAINFALL":
        if intensity > 50 and duration >= 180: return 1.0
        elif intensity > 30 and duration >= 120: return 0.6
        else: return 0.3
    elif trigger_type == "HEAT_INDEX":
        if intensity > 50: return 1.0
        elif intensity > 47: return 0.7
        else: return 0.4
    elif trigger_type == "AQI":
        if intensity > 500: return 1.0
        elif intensity > 450: return 0.7
        else: return 0.4
    elif trigger_type == "PLATFORM_DOWNTIME":
        return 1.0
    elif trigger_type == "INTERNET_SHUTDOWN":
        if duration > 480: return 1.0
        elif duration > 300: return 0.8
        else: return 0.5
    return 0.3

def _get_intensity_unit(trigger_type: str) -> str:
    return {"RAINFALL": "mm/hr", "HEAT_INDEX": "°C WBGT", "AQI": "CPCB Index",
            "PLATFORM_DOWNTIME": "minutes", "INTERNET_SHUTDOWN": "hours"}.get(trigger_type, "")

def _get_data_source(trigger_type: str) -> str:
    return {"RAINFALL": "IMD API via OpenWeatherMap", "HEAT_INDEX": "IMD Temperature + Humidity (WBGT)",
            "AQI": "CPCB India via Open-Meteo", "PLATFORM_DOWNTIME": "Blinkit Store Status API",
            "INTERNET_SHUTDOWN": "IODA (CAIDA, UC San Diego)"}.get(trigger_type, "External API")

def _generate_demo_claims(rider_id: str) -> list:
    now = datetime.datetime.utcnow()
    return [
        {"claim_id": "SHR-2026-A7F3B", "rider_id": rider_id, "event_id": "EVT-RAIN-001",
         "trigger_type": "RAINFALL", "payout_amount": 180, "resolution": "AUTO-APPROVE",
         "fraud_score": 14, "payout_status": "CREDITED", "zone": "Koramangala 4th Block",
         "store_id": "BLK-BLR-047", "created_at": (now - datetime.timedelta(days=2)).isoformat()},
        {"claim_id": "SHR-2026-B9E2C", "rider_id": rider_id, "event_id": "EVT-HEAT-002",
         "trigger_type": "HEAT_INDEX", "payout_amount": 150, "resolution": "AUTO-APPROVE",
         "fraud_score": 18, "payout_status": "CREDITED", "zone": "Koramangala 4th Block",
         "store_id": "BLK-BLR-047", "created_at": (now - datetime.timedelta(days=5)).isoformat()},
        {"claim_id": "SHR-2026-C4D1A", "rider_id": rider_id, "event_id": "EVT-PLATFORM-003",
         "trigger_type": "PLATFORM_DOWNTIME", "payout_amount": 250, "resolution": "AUTO-APPROVE",
         "fraud_score": 8, "payout_status": "CREDITED", "zone": "Koramangala 4th Block",
         "store_id": "BLK-BLR-047", "created_at": (now - datetime.timedelta(days=8)).isoformat()},
        {"claim_id": "SHR-2026-D2F5E", "rider_id": rider_id, "event_id": "EVT-NET-004",
         "trigger_type": "INTERNET_SHUTDOWN", "payout_amount": 125, "resolution": "SOFT_HOLD",
         "fraud_score": 52, "payout_status": "PROCESSING", "zone": "Koramangala 4th Block",
         "store_id": "BLK-BLR-047", "created_at": (now - datetime.timedelta(days=12)).isoformat()},
    ]
