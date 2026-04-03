"""
ShieldRide Dynamic Pricing Engine
Formula: Weekly Premium = Base Rate × ZRM × WTF × SI × CTM

Implements the complete pricing model from the ShieldRide specification:
- Zone Risk Multiplier (ZRM): 0.8x - 2.0x based on historical rainfall, waterlogging, store infrastructure
- Worker Tenure Factor (WTF): 1.0x - 1.25x based on months on platform
- Seasonal Index (SI): 1.0x - 1.6x based on calendar month
- Coverage Tier Multiplier (CTM): 1.0x - 1.5x based on selected tier
"""

from typing import Dict, Any, Optional
from datetime import datetime

# ------------- Zone Risk Multiplier (ZRM) Lookup Table -------------
# Trained on 5 years of IMD historical rainfall frequency data per pincode
# + BBMP municipal waterlogging incident reports
# + Dark store physical infrastructure assessment

ZONE_RISK_TABLE: Dict[str, Dict[str, Any]] = {
    "BLK-BLR-089": {
        "zone": "Whitefield",
        "zrm": 0.8,
        "risk_profile": "LOW",
        "risk_description": "Low rainfall, elevated terrain",
        "avg_annual_disruption_days": 8,
        "infrastructure": "ground_floor",
        "pincodes": ["560066", "560048"]
    },
    "BLK-BLR-033": {
        "zone": "Indiranagar",
        "zrm": 1.0,
        "risk_profile": "MODERATE",
        "risk_description": "Moderate rainfall, good drainage",
        "avg_annual_disruption_days": 14,
        "infrastructure": "ground_floor",
        "pincodes": ["560038", "560008"]
    },
    "BLK-BLR-047": {
        "zone": "Koramangala 4th Block",
        "zrm": 1.3,
        "risk_profile": "HIGH",
        "risk_description": "Storm drain proximity, frequent waterlogging",
        "avg_annual_disruption_days": 22,
        "infrastructure": "ground_floor",
        "pincodes": ["560034", "560095"]
    },
    "BLK-BLR-061": {
        "zone": "Bellandur",
        "zrm": 1.7,
        "risk_profile": "VERY_HIGH",
        "risk_description": "Lake overflow zone, high flood vulnerability",
        "avg_annual_disruption_days": 31,
        "infrastructure": "ground_floor",
        "pincodes": ["560103", "560037"]
    },
    "BLK-BLR-092": {
        "zone": "Indiranagar 100ft Road",
        "zrm": 1.0,
        "risk_profile": "MODERATE",
        "risk_description": "Well-drained main road, moderate risk",
        "avg_annual_disruption_days": 12,
        "infrastructure": "ground_floor",
        "pincodes": ["560038"]
    }
}

BASEMENT_LOADING = 0.3  # Additional ZRM for basement dark stores

# ------------- Worker Tenure Factor (WTF) -------------
# Standard actuarial loading for new risk profiles

def get_tenure_factor(tenure_months: int) -> tuple:
    """Returns (factor, label) based on tenure months."""
    if tenure_months <= 1:
        return (1.25, "New rider — standard actuarial loading")
    elif tenure_months <= 3:
        return (1.15, "Limited history — moderate loading")
    elif tenure_months <= 6:
        return (1.05, "Emerging history — light loading")
    else:
        return (1.0, "Established risk profile — base rate")

# ------------- Seasonal Index (SI) -------------
# Derived from 5-year IMD historical claim frequency data per month for Bengaluru

SEASONAL_INDEX: Dict[int, tuple] = {
    1:  (1.0,  "January — Winter, minimal disruption risk"),
    2:  (1.0,  "February — Winter, minimal disruption risk"),
    3:  (1.2,  "March — Pre-monsoon heat begins"),
    4:  (1.2,  "April — Pre-monsoon heat wave season"),
    5:  (1.2,  "May — Peak summer heat"),
    6:  (1.6,  "June — Monsoon onset"),
    7:  (1.6,  "July — Peak monsoon"),
    8:  (1.6,  "August — Heavy monsoon"),
    9:  (1.6,  "September — Late monsoon"),
    10: (1.3,  "October — Post-monsoon residual flooding"),
    11: (1.3,  "November — Post-monsoon fog begins"),
    12: (1.1,  "December — Winter fog affecting visibility"),
}

# ------------- Coverage Tier Multiplier (CTM) -------------

COVERAGE_TIERS = {
    "BASIC": {
        "ctm": 1.0,
        "daily_coverage": 150,
        "icon": "🌧️",
        "description": "Essential rain & heat protection"
    },
    "STANDARD": {
        "ctm": 1.25,
        "daily_coverage": 250,
        "icon": "⛈️",
        "description": "Comprehensive all-weather shield",
        "recommended": True
    },
    "PREMIUM": {
        "ctm": 1.5,
        "daily_coverage": 400,
        "icon": "🌪️",
        "description": "Maximum coverage + platform downtime"
    }
}

BASE_RATE = 50  # ₹50 per week base rate


def calculate_premium(
    store_id: str,
    tenure_months: int = 0,
    coverage_tier: str = "STANDARD",
    month: Optional[int] = None,
    is_basement: bool = False
) -> Dict[str, Any]:
    """
    Calculate the dynamic weekly premium using the full ShieldRide pricing formula.
    
    Returns a detailed breakdown of all pricing components.
    """
    if month is None:
        month = datetime.now().month
    
    # 1. Zone Risk Multiplier
    store_data = ZONE_RISK_TABLE.get(store_id, ZONE_RISK_TABLE["BLK-BLR-047"])
    zrm = store_data["zrm"]
    if is_basement:
        zrm += BASEMENT_LOADING
    
    # 2. Worker Tenure Factor
    wtf_value, wtf_label = get_tenure_factor(tenure_months)
    
    # 3. Seasonal Index
    si_value, si_label = SEASONAL_INDEX.get(month, (1.0, "Unknown"))
    
    # 4. Coverage Tier Multiplier
    tier_data = COVERAGE_TIERS.get(coverage_tier.upper(), COVERAGE_TIERS["STANDARD"])
    ctm = tier_data["ctm"]
    daily_coverage = tier_data["daily_coverage"]
    
    # Calculate step by step
    after_zrm = BASE_RATE * zrm
    after_wtf = after_zrm * wtf_value
    after_si = after_wtf * si_value
    weekly_premium = round(after_si * ctm, 2)
    
    # Calculate weekly earnings context
    estimated_weekly_earnings = 5040  # ₹720/day × 7
    premium_as_percent_of_earnings = round((weekly_premium / estimated_weekly_earnings) * 100, 1)
    
    return {
        "weekly_premium": weekly_premium,
        "daily_coverage": daily_coverage,
        "coverage_tier": coverage_tier.upper(),
        "base_rate": BASE_RATE,
        "breakdown": {
            "step_1_base": BASE_RATE,
            "step_2_after_zrm": round(after_zrm, 2),
            "step_3_after_wtf": round(after_wtf, 2),
            "step_4_after_si": round(after_si, 2),
            "step_5_final_premium": weekly_premium
        },
        "factors": {
            "zone_risk_multiplier": {
                "value": zrm,
                "zone": store_data["zone"],
                "store_id": store_id,
                "risk_profile": store_data["risk_profile"],
                "description": store_data["risk_description"],
                "is_basement": is_basement
            },
            "worker_tenure_factor": {
                "value": wtf_value,
                "tenure_months": tenure_months,
                "description": wtf_label
            },
            "seasonal_index": {
                "value": si_value,
                "month": month,
                "description": si_label
            },
            "coverage_tier_multiplier": {
                "value": ctm,
                "tier": coverage_tier.upper(),
                "daily_coverage": daily_coverage
            }
        },
        "context": {
            "estimated_weekly_earnings": estimated_weekly_earnings,
            "premium_percent_of_earnings": premium_as_percent_of_earnings,
            "formula": f"₹{BASE_RATE} × {zrm} × {wtf_value} × {si_value} × {ctm} = ₹{weekly_premium}"
        },
        "available_tiers": {
            tier_name: {
                **tier_info,
                "weekly_premium": round(BASE_RATE * zrm * wtf_value * si_value * tier_info["ctm"], 2)
            }
            for tier_name, tier_info in COVERAGE_TIERS.items()
        }
    }


def get_all_zones() -> list:
    """Returns all available dark store zones with risk data."""
    return [
        {
            "store_id": sid,
            "zone": data["zone"],
            "zrm": data["zrm"],
            "risk_profile": data["risk_profile"],
            "description": data["risk_description"],
            "avg_annual_disruption_days": data["avg_annual_disruption_days"],
            "pincodes": data["pincodes"]
        }
        for sid, data in ZONE_RISK_TABLE.items()
    ]
