import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, MapPin, TrendingUp, ShieldAlert, Cpu, PieChart, Zap, Users, LogOut } from 'lucide-react'
import { claimsApi, sessionStore } from '../api'
import { motion, AnimatePresence } from 'framer-motion'

const TRIGGER_TYPES = [
  { id: 'RAINFALL', label: 'Extreme Rainfall', icon: '🌧️', unit: 'mm/hr', defaultIntensity: 28, source: 'IMD API' },
  { id: 'HEAT_INDEX', label: 'Heat Index', icon: '🌡️', unit: '°C WBGT', defaultIntensity: 46, source: 'IMD' },
  { id: 'AQI', label: 'Severe AQI', icon: '💨', unit: 'CPCB Index', defaultIntensity: 420, source: 'CPCB' },
  { id: 'PLATFORM_DOWNTIME', label: 'Platform Downtime', icon: '🏪', unit: 'minutes', defaultIntensity: 90, source: 'Blinkit API' },
  { id: 'INTERNET_SHUTDOWN', label: 'Internet Shutdown', icon: '📡', unit: 'hours', defaultIntensity: 4, source: 'IODA' },
]

export default function InsurerDashboard() {
  const navigate = useNavigate()
  const session = sessionStore.get()
  const [stats, setStats] = useState<any>(null)
  const [activePanel, setActivePanel] = useState('overview')
  const [showToast, setShowToast] = useState(false)
  
  // Redirect riders away from insurer dashboard
  useEffect(() => {
    if (session?.role === 'rider') {
      navigate('/dashboard')
    }
  }, [])

  // Trigger Simulator State
  const [simTrigger, setSimTrigger] = useState(TRIGGER_TYPES[0])
  const [simIntensity, setSimIntensity] = useState(28)
  const [simStore, setSimStore] = useState('BLK-BLR-047')
  const [simRunning, setSimRunning] = useState(false)
  const [simResult, setSimResult] = useState<any>(null)

  const currDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const handleLogout = () => {
    sessionStore.clear()
    navigate('/')
  }

  useEffect(() => {
    // Simulate new rider signup 2.5 seconds after mounting
    const timer = setTimeout(() => setShowToast(true), 2500)
    const cleanup = setTimeout(() => setShowToast(false), 8000)
    return () => { clearTimeout(timer); clearTimeout(cleanup) }
  }, [])

  useEffect(() => {
    const fetchStats = () => {
      claimsApi.getInsurerStats()
        .then(r => setStats(r.data))
        .catch(() => setStats((prev: any) => prev || DEFAULT_STATS))
    }
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleSimulate = async () => {
    setSimRunning(true)
    setSimResult(null)
    try {
      const res = await claimsApi.simulateTrigger({
        trigger_type: simTrigger.id,
        intensity: simIntensity,
        store_ids: [simStore],
        duration_minutes: 60
      })
      setSimResult(res.data)
    } catch {
      // Generate mock simulation result
      setSimResult(MOCK_SIM_RESULT)
    }
    setSimRunning(false)
  }

  if (!stats) return (
    <div className="loading-screen">
      <div className="spinner" style={{ width: 32, height: 32 }} />
      <p className="text-sm">Loading Insurer Operations...</p>
    </div>
  )

  return (
    <div className="page-wrapper" style={{ background: 'var(--bg-space)' }}>
      {/* ─── Simulated Live Toast ─── */}
      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }}
            style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', padding: '1rem 1.5rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 10px 30px rgba(16,185,129,0.4)', color: 'white' }}>
            <div style={{ background: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>⚡</div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>New Rider Registered!</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>+1 Active Policy (BLK-BLR-047)</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Top Nav Bar ─── */}
      <div className="insurer-nav">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="icon-circle-sm" style={{ background: 'rgba(16,185,129,0.08)', color: 'var(--accent-primary)' }}>
            <Activity size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.3px', lineHeight: 1.2 }}>ShieldRide OS</h1>
            <div className="text-xs">{currDate}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="status-pill">
            <span className="status-dot green" />
            System Nominal
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* ─── Panel Navigation ─── */}
      <div style={{ padding: '0.75rem 2rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        {[
          { id: 'overview', label: 'Overview', icon: <PieChart size={14} /> },
          { id: 'triggers', label: 'Trigger Simulator', icon: <Zap size={14} /> },
          { id: 'fraud', label: 'Fraud Intel', icon: <ShieldAlert size={14} /> },
          { id: 'reserves', label: 'Reserves', icon: <Cpu size={14} /> },
        ].map(tab => (
          <button key={tab.id}
            className={`btn btn-sm ${activePanel === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActivePanel(tab.id)}
            style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="desktop-container">

        {/* ═══════════════════════════════════════
           OVERVIEW PANEL
           ═══════════════════════════════════════ */}
        {activePanel === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Active Policies', value: stats.active_policies.toLocaleString(), delta: `+${stats.net_growth} WoW`, positive: true },
                { label: 'Claims Paid', value: `₹${(stats.claims_paid_total / 1000).toFixed(1)}K`, delta: '↑ 12% vs avg', positive: true },
                { label: 'Loss Ratio', value: `${stats.loss_ratio}%`, delta: 'Target: 60-70%', positive: stats.loss_ratio >= 60 && stats.loss_ratio <= 70 },
                { label: 'Auto-Approve Rate', value: `${stats.auto_approve_rate}%`, delta: 'Target: 85%', positive: false },
                { label: 'Fraud Prevented', value: `₹${(stats.fraud_prevented_amount / 1000).toFixed(1)}K`, delta: 'From holds', positive: true },
              ].map((kpi, i) => (
                <div key={i} className="metric-card">
                  <div className="metric-label">{kpi.label}</div>
                  <div className="metric-value">{kpi.value}</div>
                  <div className={`metric-delta ${kpi.positive ? 'positive' : 'neutral'}`}>{kpi.delta}</div>
                </div>
              ))}
            </div>

            <div className="insurer-grid">
              {/* Loss Ratio Panel */}
              <div className="glass-card-static">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Loss Ratio — Current Week
                  </h2>
                  <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', fontWeight: 600 }}>
                    <TrendingUp size={14} /> LIVE
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1 }}>{stats.loss_ratio}%</div>
                    <div className="text-xs" style={{ marginTop: 6 }}>Target Band: 60-70% (Healthy)</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-sm">Paid: <span className="font-bold">₹{(stats.claims_paid_total / 1000).toFixed(1)}K</span></div>
                    <div className="text-sm">Collected: <span className="font-bold">₹{(stats.premiums_collected / 1000).toFixed(0)}K</span></div>
                  </div>
                </div>

                <div className="loss-ratio-bar">
                  <div className="loss-ratio-fill" style={{ width: `${stats.loss_ratio}%` }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                  <span className="text-xs">🟡 &lt;40% Overcharging</span>
                  <span className="text-xs" style={{ color: 'var(--accent-primary)' }}>🟢 60-70% Optimal</span>
                  <span className="text-xs">🔴 &gt;90% Unsustainable</span>
                </div>
              </div>

              {/* Cohort Retention */}
              <div className="glass-card-static">
                <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '1.25rem' }}>
                  <Users size={16} style={{ display: 'inline', marginRight: 6 }} />
                  Cohort Retention & Policy Health
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { label: 'Active Policies', value: stats.active_policies.toLocaleString(), color: 'var(--text-primary)' },
                    { label: 'New This Week', value: `+${stats.new_policies_this_week}`, color: 'var(--accent-primary)' },
                    { label: 'Lapsed', value: stats.lapsed_policies, color: 'var(--accent-danger)' },
                    { label: 'Net Growth', value: `+${stats.net_growth}`, color: 'var(--accent-primary)' },
                    { label: 'Retention (4-wk)', value: `${stats.retention_rate}%`, color: 'var(--accent-primary)' },
                    { label: 'Avg Net Benefit', value: `₹${stats.avg_net_benefit}`, color: 'var(--accent-primary)' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '0.5rem 0', borderBottom: i < 4 ? '1px solid var(--glass-border)' : 'none' }}>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Operations Map (Zone Grid) */}
              <div className="glass-card-static insurer-grid-full">
                <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={16} color="var(--accent-info)" /> Live Operations Map — Bengaluru
                </h2>
                <p className="text-xs" style={{ marginBottom: '1.25rem' }}>Real-time zone risk status across all dark stores</p>

                <div className="zone-grid">
                  {(stats.zone_reserves || []).map((zone: any, i: number) => {
                    const bgOpacity = zone.rainfall_prob > 70 ? '15' : zone.rainfall_prob > 40 ? '10' : '05'
                    return (
                      <div key={i} className="zone-cell" style={{ background: `${zone.risk_color}${bgOpacity}`, borderColor: `${zone.risk_color}30` }}>
                        <div style={{ fontSize: '1.75rem' }}>
                          {zone.rainfall_prob > 70 ? '🔴' : zone.rainfall_prob > 40 ? '🟡' : '🟢'}
                        </div>
                        <div className="zone-name">{zone.zone}</div>
                        <div className="zone-risk" style={{ color: zone.risk_color }}>{zone.rainfall_prob}% rain</div>
                        <div className="text-xs font-mono" style={{ marginTop: 2 }}>{zone.store_id}</div>
                      </div>
                    )
                  })}
                  {/* Fill remaining grid */}
                  <div className="zone-cell" style={{ background: 'rgba(16,185,129,0.03)', borderColor: 'rgba(16,185,129,0.15)' }}>
                    <div style={{ fontSize: '1.75rem' }}>🟢</div>
                    <div className="zone-name">Marathahalli</div>
                    <div className="zone-risk" style={{ color: '#10b981' }}>12% rain</div>
                  </div>
                  <div className="zone-cell" style={{ background: 'rgba(59,130,246,0.03)', borderColor: 'rgba(59,130,246,0.15)' }}>
                    <div style={{ fontSize: '1.75rem' }}>🟢</div>
                    <div className="zone-name">JP Nagar</div>
                    <div className="zone-risk" style={{ color: '#3b82f6' }}>28% rain</div>
                  </div>
                  <div className="zone-cell" style={{ background: 'rgba(245,158,11,0.03)', borderColor: 'rgba(245,158,11,0.15)' }}>
                    <div style={{ fontSize: '1.75rem' }}>🟡</div>
                    <div className="zone-name">Electronic City</div>
                    <div className="zone-risk" style={{ color: '#f59e0b' }}>52% rain</div>
                  </div>
                  <div className="zone-cell" style={{ background: 'rgba(16,185,129,0.03)', borderColor: 'rgba(16,185,129,0.15)' }}>
                    <div style={{ fontSize: '1.75rem' }}>🟢</div>
                    <div className="zone-name">Jayanagar</div>
                    <div className="zone-risk" style={{ color: '#10b981' }}>15% rain</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
           TRIGGER SIMULATOR PANEL
           ═══════════════════════════════════════ */}
        {activePanel === 'triggers' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="insurer-grid">
              {/* Simulator Controls */}
              <div className="glass-card-static">
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
                  <Zap color="var(--accent-warning)" size={20} /> Trigger Simulator
                </h2>
                <p className="text-xs" style={{ marginBottom: '1.5rem' }}>
                  Fire a test trigger to demo the zero-touch claim pipeline
                </p>

                {/* Trigger Type Selection */}
                <div className="metric-label">Trigger Type</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {TRIGGER_TYPES.map(t => (
                    <div key={t.id}
                      className={`tier-card ${simTrigger.id === t.id ? 'active' : ''}`}
                      style={{ padding: '0.75rem 1rem', marginBottom: 0 }}
                      onClick={() => { setSimTrigger(t); setSimIntensity(t.defaultIntensity) }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{t.icon}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.label}</div>
                          <div className="text-xs">{t.source}</div>
                        </div>
                      </div>
                      <span className="text-xs font-mono">{t.unit}</span>
                    </div>
                  ))}
                </div>

                {/* Intensity */}
                <div className="metric-label">Intensity: {simIntensity} {simTrigger.unit}</div>
                <div className="input-group" style={{ marginBottom: '1rem' }}>
                  <input type="number" className="input-field" value={simIntensity}
                    onChange={e => setSimIntensity(Number(e.target.value))}
                    style={{ fontSize: '1rem' }}
                  />
                  <span className="text-xs font-mono" style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{simTrigger.unit}</span>
                </div>

                {/* Store */}
                <div className="metric-label">Affected Store</div>
                <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                  <select value={simStore} onChange={e => setSimStore(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 600, width: '100%', outline: 'none' }}
                  >
                    <option value="BLK-BLR-047" style={{ background: '#0c1220' }}>BLK-BLR-047 — Koramangala</option>
                    <option value="BLK-BLR-061" style={{ background: '#0c1220' }}>BLK-BLR-061 — Bellandur</option>
                    <option value="BLK-BLR-033" style={{ background: '#0c1220' }}>BLK-BLR-033 — Indiranagar</option>
                    <option value="BLK-BLR-089" style={{ background: '#0c1220' }}>BLK-BLR-089 — Whitefield</option>
                  </select>
                </div>

                <button className="btn btn-primary" onClick={handleSimulate} disabled={simRunning} id="fire-trigger-btn">
                  {simRunning ? <><span className="spinner" /> Processing Pipeline...</> : <><Zap size={18} /> Fire Trigger</>}
                </button>
              </div>

              {/* Simulation Results */}
              <div className="glass-card-static" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                  <Activity size={20} color="var(--accent-primary)" /> Pipeline Results
                </h2>

                {!simResult && !simRunning && (
                  <div className="surface-subtle text-center" style={{ padding: '3rem 1rem' }}>
                    <Zap size={40} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.3 }} />
                    <p className="text-sm">Fire a trigger to see the zero-touch claim pipeline in action</p>
                    <p className="text-xs" style={{ marginTop: '0.5rem' }}>
                      Trigger → Eligible Riders → Fraud Score → Payout → Notification
                    </p>
                  </div>
                )}

                {simRunning && (
                  <div className="text-center" style={{ padding: '3rem 1rem' }}>
                    <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 1rem' }} />
                    <p className="font-bold">Processing Zero-Touch Pipeline...</p>
                    <p className="text-xs" style={{ marginTop: '0.5rem' }}>Detection → Identification → Scoring → Payout</p>
                  </div>
                )}

                {simResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    {/* Pipeline Summary */}
                    <div className="surface-subtle" style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                        <div>
                          <div className="text-xs">Total Claims</div>
                          <div className="font-bold" style={{ fontSize: '1.25rem' }}>{simResult.pipeline_summary?.total_claims || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs">Pipeline Time</div>
                          <div className="font-bold" style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>{simResult.pipeline_summary?.pipeline_time_seconds || 97}s</div>
                        </div>
                        <div>
                          <div className="text-xs">Auto-Approved</div>
                          <div className="font-bold" style={{ color: 'var(--accent-primary)' }}>{simResult.pipeline_summary?.auto_approved || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs">Total Payout</div>
                          <div className="font-bold" style={{ color: 'var(--accent-primary)' }}>₹{simResult.pipeline_summary?.total_payout?.toFixed(0) || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs">Soft Holds</div>
                          <div className="font-bold" style={{ color: 'var(--accent-warning)' }}>{simResult.pipeline_summary?.soft_holds || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs">Hard Holds</div>
                          <div className="font-bold" style={{ color: 'var(--accent-danger)' }}>{simResult.pipeline_summary?.hard_holds || 0}</div>
                        </div>
                      </div>
                    </div>

                    {/* Ring Detection */}
                    {simResult.ring_detection && (
                      <div className={`surface-subtle`} style={{ marginBottom: '1rem', borderLeft: `3px solid ${simResult.ring_detection.ring_status === 'CLEAR' ? 'var(--accent-primary)' : 'var(--accent-danger)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="text-sm font-bold">Ring Detection</div>
                          <span className="fraud-badge" style={{ background: simResult.ring_detection.ring_status === 'CLEAR' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: simResult.ring_detection.ring_status === 'CLEAR' ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>
                            {simResult.ring_detection.ring_status}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Individual Claims */}
                    <div className="metric-label" style={{ marginBottom: '0.5rem' }}>Processed Claims</div>
                    {(simResult.claims || []).slice(0, 8).map((claim: any, i: number) => (
                      <div key={i} className={`fraud-item ${claim.resolution === 'AUTO-APPROVE' ? 'clean' : claim.resolution === 'SOFT_HOLD' ? 'soft-hold' : 'high-risk'}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span className="fraud-badge" style={{
                            background: claim.resolution === 'AUTO-APPROVE' ? 'rgba(16,185,129,0.2)' : claim.resolution === 'SOFT_HOLD' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                            color: claim.resolution === 'AUTO-APPROVE' ? '#10b981' : claim.resolution === 'SOFT_HOLD' ? '#f59e0b' : '#ef4444'
                          }}>
                            {claim.resolution?.replace('_', ' ')}
                          </span>
                          <span className="text-xs font-mono">{claim.claim_id}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div className="text-sm font-bold">{claim.rider_name || 'Rider'}</div>
                            <div className="text-xs">Score: <span className="font-mono font-bold">{claim.fraud_score}/100</span></div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>₹{claim.payout_amount}</div>
                            <div className="text-xs">{claim.payout_status}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
           FRAUD INTEL PANEL
           ═══════════════════════════════════════ */}
        {activePanel === 'fraud' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="insurer-grid">
              <div className="glass-card-static insurer-grid-full">
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
                  <ShieldAlert color="var(--accent-danger)" size={20} /> Live Fraud Intelligence Feed
                </h2>
                <p className="text-xs" style={{ marginBottom: '1.5rem' }}>
                  Real-time 6-signal behavioral analysis with ring detection
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Left: Feed */}
                  <div>
                    {/* High Risk */}
                    <div className="fraud-item high-risk">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span className="fraud-badge" style={{ background: '#ef4444', color: '#fff' }}>HIGH RISK — RING ALARM</span>
                        <span className="text-xs font-mono">09:14 AM</span>
                      </div>
                      <div className="font-bold" style={{ marginBottom: 4 }}>BLK-BLR-047 (8 parallel claims)</div>
                      <div className="text-xs" style={{ marginBottom: 8 }}>Score Avg: <span className="font-mono font-bold" style={{ color: '#ef4444' }}>81/100</span> · Ring Detection: TRIGGERED</div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>View 6-Signal Report</button>
                        <button className="btn btn-danger btn-sm" style={{ fontSize: '0.75rem' }}>Assign Reviewer</button>
                      </div>
                    </div>

                    {/* Soft Hold */}
                    <div className="fraud-item soft-hold">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span className="fraud-badge" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>SOFT HOLD</span>
                        <span className="text-xs font-mono">09:31 AM</span>
                      </div>
                      <div className="font-bold" style={{ marginBottom: 4 }}>BLK-BLR-061 (1 claim)</div>
                      <div className="text-xs">GPS Drift + Network Instability</div>
                      <div className="text-xs" style={{ marginTop: 4 }}>Score: <span className="font-mono font-bold" style={{ color: '#f59e0b' }}>52/100</span> · <span style={{ color: 'var(--accent-primary)' }}>50% Provisional Paid</span></div>
                    </div>

                    {/* Clean */}
                    <div className="fraud-item clean">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span className="fraud-badge" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>AUTO APPROVED</span>
                        <span className="text-xs font-mono">09:44 AM</span>
                      </div>
                      <div className="font-bold" style={{ marginBottom: 4 }}>BLK-BLR-033 (3 claims)</div>
                      <div className="text-xs">Perfect behavioral fingerprint match</div>
                      <div className="text-xs" style={{ marginTop: 4 }}>Score: <span className="font-mono font-bold" style={{ color: '#10b981' }}>14/100</span> · <span style={{ color: 'var(--accent-primary)' }}>₹540 Credited</span></div>
                    </div>

                    {/* More clean */}
                    <div className="fraud-item clean">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span className="fraud-badge" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>AUTO APPROVED</span>
                        <span className="text-xs font-mono">10:02 AM</span>
                      </div>
                      <div className="font-bold" style={{ marginBottom: 4 }}>BLK-BLR-089 (2 claims)</div>
                      <div className="text-xs">Network degradation confirmed (4G→2G) — positive signal</div>
                      <div className="text-xs" style={{ marginTop: 4 }}>Score: <span className="font-mono font-bold" style={{ color: '#10b981' }}>22/100</span> · <span style={{ color: 'var(--accent-primary)' }}>₹360 Credited</span></div>
                    </div>
                  </div>

                  {/* Right: 6-Signal Reference */}
                  <div>
                    <div className="glass-card-static">
                      <h3 className="heading-md" style={{ marginBottom: '1rem' }}>6-Signal Scoring Model</h3>
                      {[
                        { signal: 'GPS Trajectory', weight: '20%', desc: 'Movement pattern near dark store' },
                        { signal: 'Accelerometer', weight: '15%', desc: 'Active → stationary transition' },
                        { signal: 'Network Transition', weight: '25%', desc: '4G→2G = positive authenticity' },
                        { signal: 'Battery Drain', weight: '10%', desc: 'Outdoor usage pattern' },
                        { signal: 'App Session', weight: '15%', desc: 'Blinkit app active pre-trigger' },
                        { signal: 'Platform Contradiction', weight: '15%', desc: 'delivery_eta vs claim check' },
                      ].map((s, i) => (
                        <div key={i} className="surface-subtle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div>
                            <div className="text-sm font-bold">{s.signal}</div>
                            <div className="text-xs">{s.desc}</div>
                          </div>
                          <span className="font-mono font-bold" style={{ color: 'var(--accent-primary)' }}>{s.weight}</span>
                        </div>
                      ))}

                      <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239,68,68,0.04)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.1)' }}>
                        <div className="text-xs font-bold" style={{ color: 'var(--accent-danger)', marginBottom: 4 }}>⚠ Critical Rule</div>
                        <div className="text-xs">No claim is ever auto-rejected. Hard Hold triggers human review — not rejection.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
           RESERVES PANEL
           ═══════════════════════════════════════ */}
        {activePanel === 'reserves' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-card-static" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.35rem' }}>
                <Cpu color="var(--accent-info)" size={20} /> Next 7 Days — Predicted Claim Exposure
              </h2>
              <p className="text-xs" style={{ marginBottom: '1.5rem' }}>
                ML-enhanced reserve recommendations based on IMD forecasts + historical claim frequency
              </p>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Rainfall Prob</th>
                    <th>Pred. Claims</th>
                    <th style={{ textAlign: 'right' }}>Rec. Reserve</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.zone_reserves || []).map((zone: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <MapPin size={14} color={zone.risk_color} /> {zone.zone}
                        </div>
                      </td>
                      <td>
                        <span className="font-mono font-bold" style={{ color: zone.risk_color, fontSize: '1rem' }}>
                          {zone.rainfall_prob}%
                        </span>
                      </td>
                      <td>{zone.predicted_claims} events</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono font-bold" style={{ color: 'var(--accent-primary)', fontSize: '1rem' }}>
                          ₹{zone.reserve.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '2px solid rgba(16,185,129,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="metric-label">Total Computed Requirement</div>
                  <div className="text-xs">Current Reserve: ₹{stats.reserve_current?.toLocaleString()} ✓</div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                  ₹{stats.reserve_recommended?.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Performance Analytics */}
            <div className="glass-card-static">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
                <PieChart color="var(--accent-purple)" size={20} /> Performance Analytics
              </h2>

              <div className="insurer-grid-3">
                {[
                  { label: 'Triggers Fired (Today)', value: stats.triggers_fired_today, delta: '↑ 12% vs avg', positive: true },
                  { label: 'Auto-Approve Rate', value: `${stats.auto_approve_rate}%`, delta: 'Target: 85%', positive: false },
                  { label: 'Est. Fraud Prevented', value: `₹${(stats.fraud_prevented_amount / 1000).toFixed(1)}K`, delta: `From ${Math.round(stats.fraud_prevented_amount / 890)} holds`, positive: true },
                  { label: 'Avg Weekly Benefit', value: `₹${stats.avg_weekly_benefit}`, delta: 'Per rider', positive: true },
                  { label: 'Avg Weekly Premium', value: `₹${stats.avg_weekly_premium}`, delta: 'Per rider', positive: true },
                  { label: 'Premium as % of Income', value: '2.6%', delta: 'vs ₹5,040/wk earnings', positive: true },
                ].map((kpi, i) => (
                  <div key={i} className="metric-card">
                    <div className="metric-label">{kpi.label}</div>
                    <div className="metric-value">{kpi.value}</div>
                    <div className={`metric-delta ${kpi.positive ? 'positive' : 'neutral'}`}>{kpi.delta}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
           RESERVES PANEL
           ═══════════════════════════════════════ */}
        {activePanel === 'reserves' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="insurer-grid" style={{ display: 'block' }}>
              <div className="glass-card-static" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Cpu size={24} color="var(--accent-primary)" />
                      Next 7 Days - Predicted Claim Exposure
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Based on IMD 7-day forecast combined with historical claim frequency per zone
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', background: 'rgba(16,185,129,0.1)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>Total Recommended Reserve</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>
                      ₹{stats.reserve_recommended.toLocaleString()}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Current Liquidity: ₹{stats.reserve_current.toLocaleString()} ✓
                    </div>
                  </div>
                </div>

                <div style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Zone (Dark Store)</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Weather Probability</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Predicted Event Volume</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Recommended Reserve</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.zone_reserves.map((z: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '1rem' }}>
                            <div className="font-bold">{z.zone}</div>
                            <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{z.store_id}</div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>{z.rainfall_prob > 70 ? '🔴' : z.rainfall_prob > 40 ? '🟡' : '🟢'}</span>
                              <span className="font-bold">{z.rainfall_prob}%</span>
                              <span className="text-xs">Rainfall</span>
                            </div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span className="font-mono font-bold" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                              {z.predicted_claims} claims
                            </span>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, color: z.risk_color }}>
                            ₹{z.reserve.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── Defaults ───

const DEFAULT_STATS = {
  claims_paid_total: 84200,
  premiums_collected: 126000,
  loss_ratio: 66.8,
  active_policies: 2847,
  new_policies_this_week: 142,
  lapsed_policies: 38,
  net_growth: 104,
  retention_rate: 92.4,
  avg_weekly_benefit: 187,
  avg_weekly_premium: 71,
  avg_net_benefit: 116,
  triggers_fired_today: 42,
  auto_approve_rate: 84.2,
  fraud_prevented_amount: 12500,
  reserve_recommended: 74200,
  reserve_current: 112000,
  zone_reserves: [
    { zone: 'Koramangala', store_id: 'BLK-BLR-047', rainfall_prob: 73, predicted_claims: '8-14', reserve: 18400, risk_color: '#f59e0b' },
    { zone: 'Bellandur', store_id: 'BLK-BLR-061', rainfall_prob: 81, predicted_claims: '12-20', reserve: 28000, risk_color: '#ef4444' },
    { zone: 'Whitefield', store_id: 'BLK-BLR-089', rainfall_prob: 22, predicted_claims: '1-3', reserve: 4200, risk_color: '#64748b' },
    { zone: 'Indiranagar', store_id: 'BLK-BLR-033', rainfall_prob: 45, predicted_claims: '4-7', reserve: 9800, risk_color: '#3b82f6' },
    { zone: 'HSR Layout', store_id: 'BLK-BLR-092', rainfall_prob: 58, predicted_claims: '6-10', reserve: 13800, risk_color: '#f59e0b' },
  ]
}

const MOCK_SIM_RESULT = {
  pipeline_summary: { total_claims: 6, auto_approved: 4, soft_holds: 1, hard_holds: 1, total_payout: 1120, pipeline_time_seconds: 97 },
  ring_detection: { ring_status: 'CLEAR' },
  claims: [
    { claim_id: 'SHR-2026-SIM01', rider_name: 'Ravi K.', resolution: 'AUTO-APPROVE', fraud_score: 14, payout_amount: 250, payout_status: 'CREDITED' },
    { claim_id: 'SHR-2026-SIM02', rider_name: 'Suresh M.', resolution: 'AUTO-APPROVE', fraud_score: 22, payout_amount: 180, payout_status: 'CREDITED' },
    { claim_id: 'SHR-2026-SIM03', rider_name: 'Ganesh R.', resolution: 'AUTO-APPROVE', fraud_score: 18, payout_amount: 250, payout_status: 'CREDITED' },
    { claim_id: 'SHR-2026-SIM04', rider_name: 'Kumar P.', resolution: 'AUTO-APPROVE', fraud_score: 28, payout_amount: 150, payout_status: 'CREDITED' },
    { claim_id: 'SHR-2026-SIM05', rider_name: 'Anil S.', resolution: 'SOFT_HOLD', fraud_score: 52, payout_amount: 125, payout_status: 'PROCESSING' },
    { claim_id: 'SHR-2026-SIM06', rider_name: 'Mohan V.', resolution: 'HARD_HOLD', fraud_score: 81, payout_amount: 0, payout_status: 'PENDING_REVIEW' },
  ]
}
