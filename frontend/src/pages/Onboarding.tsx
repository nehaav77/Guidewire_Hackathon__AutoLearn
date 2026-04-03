import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { riderApi } from '../api'
import { sessionStore } from '../api'
import type { RiderSession } from '../api'
import { CheckCircle, MapPin, Calculator, Volume2, CreditCard, ArrowLeft, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const STORES = [
  { id: 'BLK-BLR-047', name: 'Koramangala 4th Block', distance: '0.2 km', risk: 'HIGH', zrm: 1.3 },
  { id: 'BLK-BLR-061', name: 'Bellandur Central', distance: '1.4 km', risk: 'VERY HIGH', zrm: 1.7 },
  { id: 'BLK-BLR-033', name: 'Indiranagar', distance: '3.1 km', risk: 'MODERATE', zrm: 1.0 },
  { id: 'BLK-BLR-089', name: 'Whitefield', distance: '4.5 km', risk: 'LOW', zrm: 0.8 },
  { id: 'BLK-BLR-092', name: 'Indiranagar 100ft Road', distance: '5.2 km', risk: 'MODERATE', zrm: 1.0 },
]

const TIERS = [
  { id: 'BASIC', icon: '🌧️', name: 'Basic', cover: 150, ctm: 1.0, desc: 'Essential rain & heat protection' },
  { id: 'STANDARD', icon: '⛈️', name: 'Standard', cover: 250, ctm: 1.25, desc: 'Comprehensive all-weather shield', rec: true },
  { id: 'PREMIUM', icon: '🌪️', name: 'Premium', cover: 400, ctm: 1.5, desc: 'Maximum coverage + platform downtime' },
]

const SEASONAL_INDEX: Record<number, { value: number; label: string }> = {
  1: { value: 1.0, label: 'Winter — Minimal risk' },
  2: { value: 1.0, label: 'Winter — Minimal risk' },
  3: { value: 1.2, label: 'Pre-monsoon heat' },
  4: { value: 1.2, label: 'Pre-monsoon heat' },
  5: { value: 1.2, label: 'Peak summer' },
  6: { value: 1.6, label: 'Monsoon onset' },
  7: { value: 1.6, label: 'Peak monsoon' },
  8: { value: 1.6, label: 'Heavy monsoon' },
  9: { value: 1.6, label: 'Late monsoon' },
  10: { value: 1.3, label: 'Post-monsoon' },
  11: { value: 1.3, label: 'Post-monsoon fog' },
  12: { value: 1.1, label: 'Winter fog' },
}

// ─── Multi-language Policy Explanation ───
const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
]

const POLICY_TEXT: Record<string, { playing: string; what: { title: string; body: string }; how: { title: string; body: string }; rights: { title: string; body: string } }> = {
  en: {
    playing: 'Playing in English...',
    what: { title: '🛡️ What ShieldRide does:', body: 'When bad weather, extreme heat, or platform outages stop your deliveries, ShieldRide automatically pays you — no forms needed.' },
    how: { title: '💰 How it works:', body: 'A small weekly premium is deducted from your Blinkit settlement. When a trigger event occurs in your zone, money is sent to your UPI within 2 minutes.' },
    rights: { title: '✅ Your rights:', body: 'Cancel anytime. No lock-in. Claims are never auto-rejected.' },
  },
  kn: {
    playing: 'ಕನ್ನಡದಲ್ಲಿ ಪ್ಲೇ ಆಗುತ್ತಿದೆ...',
    what: { title: '🛡️ ShieldRide ಏನು ಮಾಡುತ್ತದೆ:', body: 'ಕೆಟ್ಟ ಹವಾಮಾನ, ತೀವ್ರ ಶಾಖ ಅಥವಾ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಅಡ್ಡಿಗಳು ನಿಮ್ಮ ಡೆಲಿವರಿಗಳನ್ನು ನಿಲ್ಲಿಸಿದಾಗ, ShieldRide ನಿಮಗೆ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪಾವತಿಸುತ್ತದೆ — ಯಾವುದೇ ಫಾರ್ಮ್‌ಗಳ ಅಗತ್ಯವಿಲ್ಲ.' },
    how: { title: '💰 ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ:', body: 'ಸಣ್ಣ ವಾರದ ಪ್ರೀಮಿಯಂ ನಿಮ್ಮ Blinkit ಸೆಟಲ್‌ಮೆಂಟ್‌ನಿಂದ ಕಡಿತಗೊಳ್ಳುತ್ತದೆ. ನಿಮ್ಮ ವಲಯದಲ್ಲಿ ಟ್ರಿಗ್ಗರ್ ಈವೆಂಟ್ ಸಂಭವಿಸಿದಾಗ, 2 ನಿಮಿಷಗಳಲ್ಲಿ ನಿಮ್ಮ UPI ಗೆ ಹಣ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.' },
    rights: { title: '✅ ನಿಮ್ಮ ಹಕ್ಕುಗಳು:', body: 'ಯಾವುದೇ ಸಮಯದಲ್ಲಿ ರದ್ದುಗೊಳಿಸಿ. ಲಾಕ್-ಇನ್ ಇಲ್ಲ. ಕ್ಲೈಮ್‌ಗಳನ್ನು ಎಂದಿಗೂ ಸ್ವಯಂ-ತಿರಸ್ಕರಿಸಲಾಗುವುದಿಲ್ಲ.' },
  },
  hi: {
    playing: 'हिन्दी में चल रहा है...',
    what: { title: '🛡️ ShieldRide क्या करता है:', body: 'जब खराब मौसम, अत्यधिक गर्मी, या प्लेटफ़ॉर्म बंद होने से आपकी डिलीवरी रुक जाती है, तो ShieldRide स्वचालित रूप से आपको भुगतान करता है — कोई फॉर्म नहीं भरना होगा।' },
    how: { title: '💰 यह कैसे काम करता है:', body: 'आपके Blinkit सेटलमेंट से एक छोटा साप्ताहिक प्रीमियम काटा जाता है। जब आपके ज़ोन में ट्रिगर इवेंट होता है, तो 2 मिनट में आपके UPI पर पैसा भेज दिया जाता है।' },
    rights: { title: '✅ आपके अधिकार:', body: 'कभी भी रद्द करें। कोई लॉक-इन नहीं। क्लेम कभी स्वचालित रूप से अस्वीकार नहीं किए जाते।' },
  },
  ta: {
    playing: 'தமிழில் விளையாடுகிறது...',
    what: { title: '🛡️ ShieldRide என்ன செய்கிறது:', body: 'மோசமான வானிலை, அதிக வெப்பம் அல்லது தளம் செயலிழப்பு உங்கள் டெலிவரிகளை நிறுத்தும் போது, ShieldRide தானாகவே உங்களுக்கு பணம் செலுத்துகிறது — படிவங்கள் தேவையில்லை.' },
    how: { title: '💰 இது எப்படி செயல்படுகிறது:', body: 'உங்கள் Blinkit செட்டில்மென்ட்டிலிருந்து ஒரு சிறிய வாராந்திர பிரீமியம் கழிக்கப்படுகிறது. உங்கள் மண்டலத்தில் தூண்டுதல் நிகழ்வு ஏற்படும் போது, 2 நிமிடங்களில் உங்கள் UPI க்கு பணம் அனுப்பப்படுகிறது.' },
    rights: { title: '✅ உங்கள் உரிமைகள்:', body: 'எப்போது வேண்டுமானாலும் ரத்து செய்யலாம். லாக்-இன் இல்லை. க்ளெய்ம்கள் ஒருபோதும் தானாக நிராகரிக்கப்படுவதில்லை.' },
  },
  te: {
    playing: 'తెలుగులో ప్లే అవుతోంది...',
    what: { title: '🛡️ ShieldRide ఏమి చేస్తుంది:', body: 'చెడు వాతావరణం, తీవ్ర వేడి, లేదా ప్లాట్‌ఫారమ్ అంతరాయాలు మీ డెలివరీలను ఆపినప్పుడు, ShieldRide మీకు స్వయంచాలకంగా చెల్లిస్తుంది — ఫారాలు అవసరం లేదు.' },
    how: { title: '💰 ఇది ఎలా పనిచేస్తుంది:', body: 'మీ Blinkit సెటిల్‌మెంట్ నుండి ఒక చిన్న వారపు ప్రీమియం కట్ చేయబడుతుంది. మీ జోన్‌లో ట్రిగ్గర్ ఈవెంట్ జరిగినప్పుడు, 2 నిమిషాల్లో మీ UPI కి డబ్బు పంపబడుతుంది.' },
    rights: { title: '✅ మీ హక్కులు:', body: 'ఎప్పుడైనా రద్దు చేయండి. లాక్-ఇన్ లేదు. క్లెయిమ్‌లు ఎప్పుడూ ఆటో-రిజెక్ట్ చేయబడవు.' },
  },
}


export default function Onboarding() {
  const navigate = useNavigate()
  const session = sessionStore.get() as RiderSession | null

  // If no session, redirect to login
  useEffect(() => {
    if (!session || session.role !== 'rider') {
      navigate('/')
    }
  }, [])

  const riderName = session?.name || 'Rider'
  const mobile = session?.mobile_number || ''
  const riderId = session?.rider_id || ''

  // Steps: 1=Hub, 2=Policy Explanation, 3=Coverage, 4=Confirm, 5=Success
  const [step, setStep] = useState(1)
  const totalSteps = 5
  const [loading, setLoading] = useState(false)
  const [selectedStore, setSelectedStore] = useState(STORES[0])
  const [showStoreList, setShowStoreList] = useState(false)
  const [selectedTier, setSelectedTier] = useState<(typeof TIERS[0] & { premium?: number }) | null>(null)
  const [pricingBreakdown, setPricingBreakdown] = useState<any>(null)
  const [selectedLang, setSelectedLang] = useState('en')

  const currentMonth = new Date().getMonth() + 1
  const si = SEASONAL_INDEX[currentMonth]
  const BASE_RATE = 50
  const WTF = 1.0

  useEffect(() => {
    const tierPrices = TIERS.map(t => {
      const premium = Math.round(BASE_RATE * selectedStore.zrm * WTF * si.value * t.ctm * 100) / 100
      return { ...t, premium }
    })
    setPricingBreakdown({
      base: BASE_RATE, zrm: selectedStore.zrm, wtf: WTF, si: si.value,
      si_label: si.label, zone: selectedStore.name, tiers: tierPrices
    })
  }, [selectedStore])

  const handleConfirmStore = async () => {
    setLoading(true)
    try {
      await riderApi.onboard({
        mobile_number: mobile,
        assigned_store_id: selectedStore.id,
        name: riderName
      })
    } catch { /* continue in demo mode */ }
    // Update session with selected store
    if (session) {
      sessionStore.save({ ...session, assigned_store_id: selectedStore.id })
    }
    setLoading(false)
    setStep(2)
  }

  const handleSelectTier = (tier: typeof TIERS[0] & { premium: number }) => {
    setSelectedTier(tier)
    setStep(4)
  }

  const handleConfirmPolicy = async () => {
    if (!selectedTier || !pricingBreakdown) return
    setLoading(true)
    const tierWithPremium = pricingBreakdown.tiers.find((t: any) => t.id === selectedTier.id)
    try {
      await riderApi.createPolicy({
        rider_id: riderId,
        coverage_tier: selectedTier.id,
        daily_coverage: selectedTier.cover,
        weekly_premium: tierWithPremium?.premium || selectedTier.ctm * BASE_RATE,
        store_id: selectedStore.id
      })
    } catch { /* demo continues */ }
    // Update session — rider now has active policy
    if (session) {
      sessionStore.save({ ...session, has_active_policy: true, assigned_store_id: selectedStore.id })
    }
    setLoading(false)
    setStep(5)
  }

  const pageVariants = { initial: { opacity: 0, x: 30 }, in: { opacity: 1, x: 0 }, out: { opacity: 0, x: -30 } }

  const renderProgressBar = () => (
    <div style={{ marginBottom: '1.5rem' }}>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(step / totalSteps) * 100}%` }} />
      </div>
      <div className="step-indicator">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} className={`step-dot ${i + 1 === step ? 'active' : i + 1 < step ? 'completed' : ''}`} />
        ))}
      </div>
    </div>
  )

  const riskColor = (risk: string) =>
    risk === 'LOW' ? '#10b981' : risk === 'MODERATE' ? '#3b82f6' : risk === 'HIGH' ? '#f59e0b' : '#ef4444'

  const policyContent = POLICY_TEXT[selectedLang] || POLICY_TEXT.en

  return (
    <>
      <div className="ambient-bg" />
      <div className="mobile-container">
        {step > 1 && step < 5 && (
          <button onClick={() => setStep(s => s - 1)}
            style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontWeight: 600 }}>
            <ArrowLeft size={16} /> Back
          </button>
        )}

        {/* Welcome banner for new riders */}
        {step === 1 && (
          <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            <p className="text-sm" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
              Welcome, {riderName}! 👋 Let's set up your shield.
            </p>
          </div>
        )}

        {renderProgressBar()}

        <AnimatePresence mode="wait">

          {/* ═══ STEP 1: Dark Store Selection ═══ */}
          {step === 1 && (
            <motion.div key="s1" initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.35 }}>
              <div className="text-center" style={{ marginBottom: '1.5rem' }}>
                <div className="icon-circle" style={{ margin: '0 auto' }}><MapPin size={36} /></div>
                <h1 className="heading-lg" style={{ marginTop: '0.5rem' }}>Your Blinkit Hub</h1>
                <p className="text-sm" style={{ marginTop: '0.25rem' }}>Shield triggers are based on this store's radius</p>
              </div>

              {!showStoreList ? (
                <>
                  <div className="hub-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div className="hub-title">{selectedStore.name}</div>
                        <div className="hub-id">{selectedStore.id}</div>
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', background: `${riskColor(selectedStore.risk)}15`, color: riskColor(selectedStore.risk), border: `1px solid ${riskColor(selectedStore.risk)}30` }}>
                        {selectedStore.risk} RISK
                      </span>
                    </div>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Zone Risk Multiplier: <span className="font-mono font-bold" style={{ color: 'var(--accent-primary)' }}>{selectedStore.zrm}×</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" onClick={() => setShowStoreList(true)} style={{ flex: 1 }}>Change</button>
                    <button className="btn btn-primary" onClick={handleConfirmStore} disabled={loading} style={{ flex: 2 }} id="confirm-store-btn">
                      {loading ? <><span className="spinner" /> Confirming...</> : 'Yes, Confirm ✓'}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p className="text-sm" style={{ marginBottom: '0.5rem' }}>Select your delivery hub:</p>
                  {STORES.map(s => (
                    <div key={s.id} className={`tier-card ${selectedStore.id === s.id ? 'active' : ''}`}
                      style={{ padding: '1rem', marginBottom: 0 }}
                      onClick={() => { setSelectedStore(s); setShowStoreList(false) }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.name}</div>
                        <div className="text-xs font-mono">{s.id}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: riskColor(s.risk), fontSize: '0.75rem', fontWeight: 700 }}>{s.risk}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{s.distance}</div>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => setShowStoreList(false)}>Cancel</button>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ STEP 2: Multi-Language Policy Explanation ═══ */}
          {step === 2 && (
            <motion.div key="s2" initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.35 }} className="text-center">
              <div className="icon-circle" style={{ margin: '0 auto', background: 'rgba(168, 85, 247, 0.08)', color: '#a855f7' }}>
                <Volume2 size={36} />
              </div>
              <h1 className="heading-lg" style={{ marginTop: '0.5rem' }}>Policy Explanation</h1>
              <p className="text-sm" style={{ marginTop: '0.25rem', marginBottom: '1rem' }}>
                Powered by <span style={{ color: '#a855f7', fontWeight: 700 }}>Sarvam.ai</span> — in your language
              </p>

              {/* Language Selector */}
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {LANGUAGES.map(lang => (
                  <button key={lang.code}
                    onClick={() => setSelectedLang(lang.code)}
                    style={{
                      padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)',
                      background: selectedLang === lang.code ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
                      color: selectedLang === lang.code ? '#000' : 'var(--text-secondary)',
                      border: selectedLang === lang.code ? 'none' : '1px solid var(--glass-border)',
                      cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}>
                    {lang.flag} {lang.label}
                  </button>
                ))}
              </div>

              <div className="glass-card-static" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    🔊
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      <Globe size={14} style={{ display: 'inline', marginRight: 6 }} />
                      Voice + Text Explanation
                    </div>
                    <div className="text-xs">{policyContent.playing}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', padding: '1rem', fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  <p style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{policyContent.what.title}</strong><br />
                    {policyContent.what.body}
                  </p>
                  <p style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{policyContent.how.title}</strong><br />
                    {policyContent.how.body}
                  </p>
                  <p>
                    <strong style={{ color: 'var(--text-primary)' }}>{policyContent.rights.title}</strong><br />
                    {policyContent.rights.body}
                  </p>
                </div>
              </div>

              <button className="btn btn-primary" onClick={() => setStep(3)} id="policy-understood-btn">
                I Understand — Continue →
              </button>
            </motion.div>
          )}

          {/* ═══ STEP 3: Coverage Tier Selection + Dynamic Pricing ═══ */}
          {step === 3 && pricingBreakdown && (
            <motion.div key="s3" initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.35 }}>
              <div className="text-center" style={{ marginBottom: '1rem' }}>
                <div className="icon-circle" style={{ margin: '0 auto', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6' }}>
                  <Calculator size={36} />
                </div>
                <h1 className="heading-lg" style={{ marginTop: '0.5rem' }}>Select Coverage</h1>
                <p className="text-sm" style={{ marginTop: '0.25rem' }}>Dynamic pricing based on your zone risk</p>
              </div>

              <div className="surface-subtle" style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
                <div className="text-xs font-bold" style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Your Dynamic Pricing Formula
                </div>
                <div className="pricing-step"><span className="label">📍 Zone ({pricingBreakdown.zone})</span><span className="multiplier">{pricingBreakdown.zrm}×</span></div>
                <div className="pricing-step"><span className="label">📅 Season ({pricingBreakdown.si_label})</span><span className="multiplier">{pricingBreakdown.si}×</span></div>
                <div className="pricing-step"><span className="label">🕐 Tenure</span><span className="multiplier">{pricingBreakdown.wtf}×</span></div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'center', fontFamily: 'monospace' }}>
                  ₹{pricingBreakdown.base} base × {pricingBreakdown.zrm} × {pricingBreakdown.wtf} × {pricingBreakdown.si} × CTM
                </div>
              </div>

              {pricingBreakdown.tiers.map((t: any) => (
                <div key={t.id} className={`tier-card ${t.rec ? 'recommended' : ''}`}
                  onClick={() => !loading && handleSelectTier(t)}
                  style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer' }}
                  id={`tier-${t.id.toLowerCase()}`}>
                  <div className="tier-info">
                    <div className="tier-icon">{t.icon}</div>
                    <div>
                      <div className="tier-name">{t.name}{t.rec && <span className="badge-rec">Recommended</span>}</div>
                      <div className="tier-desc">₹{t.cover}/day protected</div>
                    </div>
                  </div>
                  <div className="tier-price"><div className="amount">₹{t.premium}</div><div className="period">/week</div></div>
                </div>
              ))}
            </motion.div>
          )}

          {/* ═══ STEP 4: Confirm & Activate ═══ */}
          {step === 4 && selectedTier && pricingBreakdown && (
            <motion.div key="s4" initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.35 }} className="text-center">
              <div className="icon-circle" style={{ margin: '0 auto', background: 'rgba(16, 185, 129, 0.08)' }}>
                <CreditCard size={36} />
              </div>
              <h1 className="heading-lg" style={{ marginTop: '0.5rem' }}>Confirm & Activate</h1>
              <p className="text-sm" style={{ marginTop: '0.25rem', marginBottom: '1.5rem' }}>Review your policy details</p>

              <div className="glass-card-static" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Coverage Tier</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedTier.icon} {selectedTier.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Daily Protection</div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-primary)' }}>₹{selectedTier.cover}/day</div>
                  </div>
                </div>

                <div className="text-xs font-bold" style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Premium Breakdown</div>
                <div className="pricing-step"><span className="label">Base Rate</span><span className="result">₹{pricingBreakdown.base}</span></div>
                <div className="pricing-step"><span className="label">× Zone Risk ({pricingBreakdown.zone})</span><span className="multiplier">{pricingBreakdown.zrm}×</span></div>
                <div className="pricing-step"><span className="label">× Tenure Factor</span><span className="multiplier">{pricingBreakdown.wtf}×</span></div>
                <div className="pricing-step"><span className="label">× Seasonal Index</span><span className="multiplier">{pricingBreakdown.si}×</span></div>
                <div className="pricing-step"><span className="label">× Coverage Tier</span><span className="multiplier">{selectedTier.ctm}×</span></div>
                <div className="pricing-total">
                  <span style={{ fontWeight: 700 }}>Weekly Premium</span>
                  <span style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--accent-primary)' }}>
                    ₹{pricingBreakdown.tiers.find((t: any) => t.id === selectedTier.id)?.premium}
                  </span>
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span className="text-sm">Rider</span>
                    <span style={{ fontWeight: 600 }}>{riderName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span className="text-sm">Linked UPI</span>
                    <span style={{ fontWeight: 600 }}>{mobile}@paytm</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-sm">Deduction</span>
                    <span className="text-sm">Auto from Blinkit settlement (Fridays)</span>
                  </div>
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleConfirmPolicy} disabled={loading} id="activate-shield-btn">
                {loading ? <><span className="spinner" /> Activating...</> : '🛡️ Confirm & Activate Shield'}
              </button>
            </motion.div>
          )}

          {/* ═══ STEP 5: Success ═══ */}
          {step === 5 && (
            <motion.div key="s5" initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.4 }} className="text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}>
                <div className="icon-circle" style={{ margin: '0 auto', width: 88, height: 88, background: 'rgba(16, 185, 129, 0.15)' }}>
                  <CheckCircle size={44} />
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h1 className="heading-xl" style={{ color: 'var(--accent-primary)', marginTop: '1rem' }}>Shield Active! 🛡️</h1>
                <p className="text-body" style={{ fontSize: '1.1rem', margin: '0.75rem 0 2rem', color: 'var(--text-primary)' }}>
                  {riderName}, your income is now protected.
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
                <div className="glass-card-static" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span className="text-sm">Coverage</span>
                    <span style={{ fontWeight: 700 }}>{selectedTier?.icon} {selectedTier?.name} — ₹{selectedTier?.cover}/day</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span className="text-sm">Hub</span>
                    <span style={{ fontWeight: 600 }}>{selectedStore.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span className="text-sm">Linked UPI</span>
                    <span style={{ fontWeight: 600 }}>{mobile}@paytm</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
                    <span className="text-sm">Weekly Premium</span>
                    <span style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
                      ₹{pricingBreakdown?.tiers?.find((t: any) => t.id === selectedTier?.id)?.premium}
                    </span>
                  </div>
                </div>

                <button className="btn btn-primary" onClick={() => navigate('/dashboard')} id="goto-dashboard-btn">
                  Go to Dashboard →
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
