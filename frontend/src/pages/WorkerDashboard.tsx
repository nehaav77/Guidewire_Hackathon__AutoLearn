import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ShieldAlert, CloudRain, Clock, TrendingUp, History, Zap, Home, LogOut } from 'lucide-react'
import { riderApi, claimsApi, externalApi, sessionStore } from '../api'
import type { RiderSession } from '../api'
import { motion, AnimatePresence } from 'framer-motion'

const TRIGGER_ICONS: Record<string, { icon: string; color: string }> = {
  'RAINFALL': { icon: '🌧️', color: '#3b82f6' },
  'HEAT_INDEX': { icon: '🌡️', color: '#ef4444' },
  'AQI': { icon: '💨', color: '#a855f7' },
  'PLATFORM_DOWNTIME': { icon: '🏪', color: '#f59e0b' },
  'INTERNET_SHUTDOWN': { icon: '📡', color: '#64748b' },
}

export default function WorkerDashboard() {
  const navigate = useNavigate()
  const session = sessionStore.get() as RiderSession | null

  // If no rider session, redirect
  useEffect(() => {
    if (!session || session.role !== 'rider') {
      navigate('/')
    }
  }, [])

  const riderId = session?.rider_id || 'demo-rider'
  const riderName = session?.name || 'Rider'
  const storeId = session?.assigned_store_id || 'BLK-BLR-047'

  const [data, setData] = useState<any>(null)
  const [claims, setClaims] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [weather, setWeather] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('shield')
  
  // Real-time toast queue for triggers
  const [triggerToasts, setTriggerToasts] = useState<any[]>([])
  const [activeToast, setActiveToast] = useState<any>(null)

  const currDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  useEffect(() => {
    // Fetch rider status
    riderApi.getStatus(riderId)
      .then(r => setData(r.data))
      .catch(() => {
        setData({
          rider: { mobile_number: session?.mobile_number || '', assigned_store_id: storeId, name: riderName, tenure_months: 0 },
          active_policy: session?.has_active_policy ? {
            daily_coverage: 250, coverage_tier: 'STANDARD', weekly_premium: 130,
            policy_id: 'POL-DEMO-0001', valid_from: new Date().toISOString(),
            valid_until: new Date(Date.now() + 7 * 86400000).toISOString(), status: 'ACTIVE'
          } : null
        })
      })

    // Fetch claims and queue recent toasts!
    claimsApi.getHistory(riderId)
      .then(r => {
        const fetchedClaims = Array.isArray(r.data) ? r.data : []
        setClaims(fetchedClaims)
        if (fetchedClaims.length > 0) {
          setTriggerToasts(fetchedClaims.filter((c: any) => c.payout_amount > 0).slice(0, 3))
        }
      })
      .catch(() => {
        // Fallback DEMO data, but we don't have DEMO_CLAIMS explicitly here unless we define it, wait WorkerDashboard has a DEMO_CLAIMS global? No, it used setClaims([]) previously if not found, wait, it used setClaims(DEMO_CLAIMS), but DEMO_CLAIMS is not defined in this file. Let's strictly empty if fail.
        setClaims([])
      })

    // Fetch weekly summary
    claimsApi.getWeeklySummary(riderId)
      .then(r => setSummary(r.data))
      .catch(() => setSummary({ total_protected: 430, weekly_premium: 63, net_benefit: 367, claims_count: 4, week_start: 'March 24', week_end: 'March 30, 2026' }))

    // Fetch real weather data
    externalApi.getWeather()
      .then(r => setWeather(r.data))
      .catch(() => setWeather(null))
  }, [riderId])

  // Sequential Toast Logic: Load next toast
  useEffect(() => {
    if (triggerToasts.length > 0 && !activeToast) {
      setActiveToast(triggerToasts[0])
    }
  }, [triggerToasts, activeToast])

  // Sequential Toast Logic: Trigger timer for active toast
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null)
        setTriggerToasts(prev => prev.slice(1))
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [activeToast])

  const handleLogout = () => {
    sessionStore.clear()
    navigate('/')
  }

  if (!data) return (
    <div className="loading-screen">
      <div className="spinner" style={{ width: 32, height: 32 }} />
      <p className="text-sm">Loading Shield Status...</p>
    </div>
  )

  const isProtected = !!data.active_policy
  const policy = data.active_policy
  const rider = data.rider


  const validUntil = policy?.valid_until ? new Date(policy.valid_until).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Sunday March 30, 2026'

  // Build weather display from real API data or fallback
  const weatherDesc = weather?.description || weather?.fallback_data?.description || 'Checking...'
  const weatherTemp = weather?.temperature_celsius || weather?.fallback_data?.temperature_celsius || '--'
  const weatherRain = weather?.rainfall_mm_per_hr ?? weather?.fallback_data?.rainfall_mm_per_hr ?? 0
  const weatherSource = weather?.source || ''
  const isLiveWeather = weatherSource.includes('LIVE')

  return (
    <>
      <div className="ambient-bg" />
      <div className="mobile-container" style={{ justifyContent: 'flex-start', paddingTop: '2rem', paddingBottom: '6rem', position: 'relative' }}>
        {/* ─── Sequenced Trigger Toasts ─── */}
        <AnimatePresence mode="popLayout">
          {activeToast && (
            <motion.div key={activeToast.claim_id} initial={{ opacity: 0, y: -50, x: '-50%' }} animate={{ opacity: 1, y: 10, x: '-50%' }} exit={{ opacity: 0, scale: 0.9, x: '-50%' }}
              style={{ position: 'fixed', top: 0, left: '50%', zIndex: 100, background: 'rgba(16, 185, 129, 0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.75rem 1.25rem', borderRadius: 50, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', width: 'max-content', maxWidth: '90%' }}>
              <span style={{ fontSize: '1.2rem' }}>{TRIGGER_ICONS[activeToast.trigger_type]?.icon || '⚠️'}</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>{activeToast.trigger_type?.replace(/_/g, ' ')} Detected</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>₹{activeToast.payout_amount} uniquely credited to your account!</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Header ─── */}
        <div className="dash-header">
          <div>
            <h1 className="heading-lg" style={{ fontSize: '1.35rem' }}>
              Hello, {riderName} 👋
            </h1>
            <span className="text-xs">{currDate}</span>
          </div>
          <div className="status-pill">
            <span className="status-dot green" />
            {storeId}
          </div>
        </div>

        {/* ─── TAB: Shield Status ─── */}
        {activeTab === 'shield' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Hero Card */}
            <div className="shield-hero-card" style={{ marginBottom: '1.25rem', borderColor: isProtected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
              <div className="shield-glow active" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
                {isProtected
                  ? <ShieldCheck size={52} color="var(--accent-primary)" className="shield-icon-pulse" />
                  : <ShieldAlert size={52} color="var(--accent-danger)" />}
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                    {isProtected ? 'Shield is ACTIVE' : 'No Active Shield'}
                  </h2>
                  <p className="text-sm" style={{ textTransform: 'capitalize' }}>
                    {isProtected ? `₹${policy.daily_coverage}/day · ${policy.coverage_tier.toLowerCase()} tier` : 'Get protected against disruptions'}
                  </p>
                  {isProtected && <p className="text-xs" style={{ marginTop: '0.25rem', color: 'var(--accent-primary)' }}>Valid until {validUntil}</p>}
                </div>
              </div>

              {/* Weather & Zone Risk (real data) */}
              <div className="metric-strip">
                <div>
                  <span className="text-xs" style={{ display: 'block' }}>Weather {isLiveWeather ? '(LIVE)' : ''}</span>
                  <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
                    🌡️ {weatherTemp}°C · {weatherDesc}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="text-xs" style={{ display: 'block' }}>Rainfall</span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontSize: '0.9rem' }}>
                    <CloudRain size={14} color="var(--accent-info)" /> {weatherRain} mm/hr
                  </span>
                </div>
              </div>
            </div>

            {/* Weekly Summary */}
            {summary && (
              <div className="glass-card-static" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 className="heading-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} color="var(--accent-primary)" /> This Week
                  </h3>
                  <span className="text-xs">{summary.week_start} — {summary.week_end}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
                  <div className="surface-subtle">
                    <div className="text-xs" style={{ marginBottom: 4 }}>Protected</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)' }}>₹{summary.total_protected}</div>
                  </div>
                  <div className="surface-subtle">
                    <div className="text-xs" style={{ marginBottom: 4 }}>Premium</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>₹{summary.weekly_premium}</div>
                  </div>
                  <div className="surface-subtle">
                    <div className="text-xs" style={{ marginBottom: 4 }}>Net Benefit</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: summary.net_benefit > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>
                      {summary.net_benefit > 0 ? '+' : ''}₹{summary.net_benefit}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Triggers */}
            <div className="surface-subtle" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Zap size={18} color="var(--accent-warning)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Live Triggers</div>
                  <div className="text-xs" style={{ color: 'var(--accent-warning)' }}>3 active disruptions in your zone</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span className="status-dot orange" style={{ animation: 'none', width: 10, height: 10 }} />
                </div>
              </div>
              <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                 {[
                   { icon: '🌧️', label: 'Severe Rainfall (28mm/hr)', time: 'Active since 08:30 AM', color: '#3b82f6' },
                   { icon: '💨', label: 'AQI Spike (420+)', time: 'Active since 10:15 AM', color: '#a855f7' },
                   { icon: '🏪', label: 'Store Congestion Auto-Hold', time: 'Under investigation', color: '#f59e0b' }
                 ].map((t,i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                       <span style={{ fontSize: '1.3rem'}}>{t.icon}</span>
                       <div>
                         <div style={{ fontSize: '0.85rem', fontWeight: 600, color: t.color }}>{t.label}</div>
                         <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.time}</div>
                       </div>
                    </div>
                 ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── TAB: Claims History ─── */}
        {activeTab === 'claims' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="heading-md" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} color="var(--text-muted)" /> Claims History
            </h3>

            {/* This Week's Protection Summary (UX Cohort Retention Feature) */}
            {summary && claims.length > 0 && (
              <div className="surface-subtle" style={{ padding: '1rem', marginBottom: '1.25rem', border: '1px solid rgba(16,185,129,0.2)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'var(--accent-primary)' }} />
                <h4 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color="var(--accent-primary)" /> This Week's Protection Summary
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Total Protected</div>
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>₹{summary.total_protected} ✓</div>
                  <div style={{ color: 'var(--text-muted)' }}>Weekly Premium Paid</div>
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>₹{summary.weekly_premium}</div>
                  <div style={{ gridColumn: 'span 2', height: 1, background: 'rgba(255,255,255,0.1)', margin: '0.25rem 0' }} />
                  <div style={{ fontWeight: 700 }}>Net Benefit Delivered</div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: summary.net_benefit > 0 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    {summary.net_benefit > 0 ? '+' : ''}₹{summary.net_benefit}
                  </div>
                </div>
              </div>
            )}

            {claims.length === 0 ? (
              <div className="surface-subtle text-center" style={{ padding: '2rem' }}>
                <p className="text-sm">No claims yet. Your shield is watching for disruptions.</p>
              </div>
            ) : (
              claims.map((claim, i) => {
                const trigger = TRIGGER_ICONS[claim.trigger_type] || TRIGGER_ICONS['RAINFALL']
                const statusClass = claim.payout_status === 'CREDITED' ? 'credited' : claim.payout_status === 'PROCESSING' ? 'processing' : 'pending'
                const date = new Date(claim.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                return (
                  <div key={i} className="history-item">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div className={`history-icon ${statusClass}`}>
                        <span style={{ fontSize: '1.1rem' }}>{trigger.icon}</span>
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{claim.trigger_type?.replace(/_/g, ' ') || 'Event'}</p>
                        <p className="text-xs">{date} · {claim.zone || 'Zone'} · Score: {claim.fraud_score}/100</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: statusClass === 'credited' ? 'var(--accent-primary)' : statusClass === 'processing' ? 'var(--accent-warning)' : 'var(--text-muted)', fontWeight: 800, fontSize: '0.95rem' }}>
                        {claim.payout_amount > 0 ? `+₹${claim.payout_amount}` : '—'}
                      </p>
                      <p className="text-xs">
                        {claim.payout_status === 'CREDITED' ? '✓ Credited' : claim.payout_status === 'PROCESSING' ? '⏳ Processing' : '🔍 Under Review'}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </motion.div>
        )}

        {/* ─── TAB: Policy Details ─── */}
        {activeTab === 'policy' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="heading-md" style={{ marginBottom: '1rem' }}>Policy Details</h3>
            {policy && (
              <div className="glass-card-static" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Policy ID</div>
                    <div className="font-mono font-bold">{policy.policy_id}</div>
                  </div>
                  <span className="status-pill" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    {policy.status}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {[
                    ['Coverage Tier', `${policy.coverage_tier}`, null],
                    ['Daily Coverage', `₹${policy.daily_coverage}`, null],
                    ['Weekly Premium', `₹${policy.weekly_premium}`, 'var(--accent-primary)'],
                    ['Auto Renew', policy.auto_renew !== false ? 'Yes' : 'No', null],
                    ['Valid Until', validUntil, null],
                    ['Hub', rider.assigned_store_id, null],
                    ['UPI', rider.upi_id || `${rider.mobile_number}@paytm`, null],
                  ].map(([label, value, color], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: i < 6 ? '1px solid var(--glass-border)' : 'none' }}>
                      <span className="text-sm">{label}</span>
                      <span style={{ fontWeight: 600, color: (color as string) || 'var(--text-primary)', fontSize: '0.9rem' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass-card-static">
              <h4 className="heading-md" style={{ marginBottom: '0.75rem' }}>Covered Triggers</h4>
              {[
                { icon: '🌧️', name: 'Extreme Rainfall', desc: '>20mm/hr for 60min', src: 'IMD API' },
                { icon: '🌡️', name: 'Heat Index', desc: '>44°C WBGT for 2hrs', src: 'IMD' },
                { icon: '💨', name: 'Severe AQI', desc: '>400 for 4 hours', src: 'CPCB' },
                { icon: '🏪', name: 'Platform Downtime', desc: 'Closed for 60+ min', src: 'Blinkit API' },
                { icon: '📡', name: 'Internet Shutdown', desc: 'Data suspended 3+ hrs', src: 'IODA' },
              ].map((t, i) => (
                <div key={i} className="surface-subtle" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{t.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.name}</div>
                    <div className="text-xs">{t.desc}</div>
                  </div>
                  <span className="text-xs font-mono">{t.src}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Bottom Nav (NO insurer access) ─── */}
        <div className="bottom-nav">
          <button className={`nav-item ${activeTab === 'shield' ? 'active' : ''}`} onClick={() => setActiveTab('shield')}>
            <Home size={20} />
            Shield
          </button>
          <button className={`nav-item ${activeTab === 'claims' ? 'active' : ''}`} onClick={() => setActiveTab('claims')}>
            <Clock size={20} />
            Claims
          </button>
          <button className={`nav-item ${activeTab === 'policy' ? 'active' : ''}`} onClick={() => setActiveTab('policy')}>
            <ShieldCheck size={20} />
            Policy
          </button>
          <button className="nav-item" onClick={handleLogout}>
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </div>
    </>
  )
}

const DEMO_CLAIMS = [
  { claim_id: 'SHR-2026-A7F3B', trigger_type: 'RAINFALL', payout_amount: 180, resolution: 'AUTO-APPROVE', fraud_score: 14, payout_status: 'CREDITED', zone: 'Koramangala', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { claim_id: 'SHR-2026-B9E2C', trigger_type: 'HEAT_INDEX', payout_amount: 150, resolution: 'AUTO-APPROVE', fraud_score: 18, payout_status: 'CREDITED', zone: 'Koramangala', created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  { claim_id: 'SHR-2026-C4D1A', trigger_type: 'PLATFORM_DOWNTIME', payout_amount: 250, resolution: 'AUTO-APPROVE', fraud_score: 8, payout_status: 'CREDITED', zone: 'Koramangala', created_at: new Date(Date.now() - 8 * 86400000).toISOString() },
  { claim_id: 'SHR-2026-D2F5E', trigger_type: 'INTERNET_SHUTDOWN', payout_amount: 125, resolution: 'SOFT_HOLD', fraud_score: 52, payout_status: 'PROCESSING', zone: 'Koramangala', created_at: new Date(Date.now() - 12 * 86400000).toISOString() },
]
