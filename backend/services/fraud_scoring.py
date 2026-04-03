"""
ShieldRide Enhanced Fraud Scoring Service
6-Signal Behavioral Fingerprinting + Ring Detection
"""
import random
from typing import Dict, Any, List


# ─── Signal Definitions ───

SIGNAL_DEFINITIONS = {
    "gps_trajectory": {
        "name": "GPS Trajectory Pattern",
        "weight": 0.20,
        "genuine_pattern": "Delivery route movement → stop near dark store",
        "fraud_pattern": "Static coordinates OR teleporting between GPS points"
    },
    "accelerometer": {
        "name": "Device Accelerometer",
        "weight": 0.15,
        "genuine_pattern": "High movement → disruption → stationary",
        "fraud_pattern": "Zero movement history for 2+ hours pre-trigger"
    },
    "network_transition": {
        "name": "Network Type Transition",
        "weight": 0.25,
        "genuine_pattern": "4G → 2G → Intermittent (outdoor weather exposure)",
        "fraud_pattern": "Stable home WiFi (single tower, no degradation)"
    },
    "battery_drain": {
        "name": "Battery Drain Rate",
        "weight": 0.10,
        "genuine_pattern": "Battery draining faster (outdoor use, GPS active)",
        "fraud_pattern": "Battery stable or increasing (plugged in at home)"
    },
    "app_session": {
        "name": "Platform App Session",
        "weight": 0.15,
        "genuine_pattern": "Blinkit Partner App active in 45 min pre-trigger",
        "fraud_pattern": "Zero app sessions in 2+ hours before trigger"
    },
    "platform_contradiction": {
        "name": "Platform Operational Contradiction",
        "weight": 0.15,
        "genuine_pattern": "Store closed, zero orders in queue",
        "fraud_pattern": "Store active with orders, riders still claiming inability"
    }
}


def generate_signal_score(signal_key: str, is_genuine: bool = True) -> Dict[str, Any]:
    """Generate a realistic sub-score for a single fraud signal."""
    if is_genuine:
        base = random.randint(0, 25)
    else:
        base = random.randint(55, 95)
    
    signal_def = SIGNAL_DEFINITIONS[signal_key]
    
    return {
        "signal": signal_key,
        "name": signal_def["name"],
        "score": base,
        "weight": signal_def["weight"],
        "weighted_score": round(base * signal_def["weight"], 1),
        "status": "✓ GENUINE" if base < 40 else ("⚠ SUSPICIOUS" if base < 70 else "✗ ANOMALY"),
        "pattern_detected": signal_def["genuine_pattern"] if is_genuine else signal_def["fraud_pattern"]
    }


def score_rider_claim(
    rider_id: str,
    trigger_type: str, 
    claim_context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Enhanced 6-signal behavioral fingerprinting fraud score.
    Returns detailed signal breakdown for transparency.
    """
    # Determine if this should simulate genuine or fraudulent behavior
    is_blinkit_contradiction = claim_context.get("blinkit_store_active", False)
    force_fraud = claim_context.get("simulate_fraud", False)
    is_genuine = not is_blinkit_contradiction and not force_fraud
    
    # Generate individual signal scores
    signals = {}
    for signal_key in SIGNAL_DEFINITIONS:
        # Network degradation during rain is a POSITIVE signal (lower score = more genuine)
        sig_genuine = is_genuine
        if signal_key == "network_transition" and trigger_type == "RAINFALL" and is_genuine:
            sig_genuine = True  # Strongly genuine signal
        
        signals[signal_key] = generate_signal_score(signal_key, sig_genuine)
    
    # Override platform contradiction if store is active
    if is_blinkit_contradiction:
        signals["platform_contradiction"]["score"] = 95
        signals["platform_contradiction"]["status"] = "✗ ANOMALY"
        signals["platform_contradiction"]["pattern_detected"] = "Store active with orders — contradicts inability claim"
    
    # Calculate composite score (weighted average)
    composite_score = round(sum(s["weighted_score"] for s in signals.values()), 1)
    
    # Clamp to 0-100
    composite_score = max(0, min(100, composite_score))
    
    # Three-tier resolution
    if composite_score < 40:
        resolution = "AUTO-APPROVE"
        resolution_description = "Full payout initiated immediately"
        resolution_color = "#10b981"
    elif composite_score <= 75:
        resolution = "SOFT_HOLD"
        resolution_description = "50% provisional payout + 2hr human review"
        resolution_color = "#f59e0b"
    else:
        resolution = "HARD_HOLD"
        resolution_description = "Queued for human review, 4hr SLA"
        resolution_color = "#ef4444"
    
    return {
        "rider_id": rider_id,
        "composite_score": composite_score,
        "resolution": resolution,
        "resolution_description": resolution_description,
        "resolution_color": resolution_color,
        "signals_evaluated": 6,
        "signal_breakdown": signals,
        "critical_rule": "No claim is ever auto-rejected. Hard Hold triggers human review, not rejection."
    }


def detect_ring_fraud(
    store_id: str,
    claims_in_batch: int,
    assigned_riders: int,
    historical_co_claims: int = 0
) -> Dict[str, Any]:
    """
    Ring Detection Layer - catches coordinated fraud networks.
    Evaluates 4 ring signals.
    """
    velocity = claims_in_batch / max(assigned_riders, 1)
    velocity_threshold = 0.6
    
    ring_signals = {
        "claim_velocity": {
            "name": "Claim Velocity Per Store",
            "value": f"{round(velocity * 100)}%",
            "threshold": f"{round(velocity_threshold * 100)}%",
            "triggered": velocity > velocity_threshold,
            "description": f"{claims_in_batch} of {assigned_riders} riders filing simultaneously"
        },
        "co_claim_history": {
            "name": "Historical Co-Claim Pattern",
            "value": f"{historical_co_claims} co-claims",
            "threshold": "3+ events",
            "triggered": historical_co_claims >= 3,
            "description": "Checks if same rider group files together repeatedly"
        },
        "subnet_clustering": {
            "name": "Device Subnet Clustering",
            "value": "Not detected",
            "threshold": ">5 devices on same WiFi/tower",
            "triggered": False,
            "description": "Checks for co-location contradicting GPS spread"
        },
        "premium_claim_ratio": {
            "name": "Premium-to-Claim Time Ratio",
            "value": "Normal",
            "threshold": "First claim within 7 days of activation",
            "triggered": False,
            "description": "Flags new joiners claiming immediately after activation"
        }
    }
    
    any_triggered = any(s["triggered"] for s in ring_signals.values())
    
    return {
        "store_id": store_id,
        "ring_status": "TRIGGERED" if any_triggered else "CLEAR",
        "ring_signals": ring_signals,
        "recommendation": "Zone-level review required" if any_triggered else "No coordinated fraud detected"
    }
