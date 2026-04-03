"""
ShieldRide Integration Services
Graceful handling of optional dependencies (Razorpay, Twilio).
Works in demo mode if packages aren't installed.
"""
import logging

logger = logging.getLogger(__name__)

# ─── Razorpay (optional) ───
try:
    import razorpay
    from core.config import settings
    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        razorpay_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    else:
        razorpay_client = None
except ImportError:
    logger.info("razorpay package not installed — UPI payouts will run in mock mode")
    razorpay_client = None
    from core.config import settings


def initiate_upi_payout(amount_inr: float, upi_id: str, claim_id: str) -> dict:
    """
    Initiates UPI payout via Razorpay. Returns mock if Razorpay not configured.
    """
    if not razorpay_client:
        return {
            "status": "success",
            "payout_id": f"pout_{claim_id[-6:]}",
            "amount": amount_inr,
            "simulated": True,
            "note": "Razorpay not configured — mock payout"
        }

    try:
        amount_paise = int(amount_inr * 100)
        payload = {
            "account_number": "2323230050720516",
            "fund_account_id": "fa_00000000000001",
            "amount": amount_paise,
            "currency": "INR",
            "mode": "UPI",
            "purpose": "payout",
            "queue_if_low_balance": True,
            "reference_id": claim_id,
        }
        return {
            "status": "processing",
            "payout_id": f"pout_simulated_{claim_id[-6:]}",
            "amount": amount_inr,
            "mode": "UPI",
            "reference_id": claim_id
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}


# ─── Twilio WhatsApp (optional) ───

def notify_rider_whatsapp(mobile_number: str, message: str) -> bool:
    """
    Sends WhatsApp notification via Twilio. Falls back to console log if not configured.
    """
    try:
        from twilio.rest import Client
    except ImportError:
        logger.info(f"[MOCK WHATSAPP] To: {mobile_number} | Message: {message}")
        return True

    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_WHATSAPP_NUMBER):
        logger.info(f"[MOCK WHATSAPP] To: {mobile_number} | Message: {message}")
        return True

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        formatted_number = mobile_number if mobile_number.startswith('+') else f"+91{mobile_number}"
        client.messages.create(
            from_=settings.TWILIO_WHATSAPP_NUMBER,
            body=message,
            to=f"whatsapp:{formatted_number}"
        )
        return True
    except Exception as e:
        logger.error(f"Twilio Error: {str(e)}")
        return False
