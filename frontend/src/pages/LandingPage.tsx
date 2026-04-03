import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Bike, BarChart3, ArrowRight, Lock, Phone, Mail, Eye, EyeOff, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { authApi, sessionStore } from '../api'

export default function LandingPage() {
  const navigate = useNavigate()
  const [showLogin, setShowLogin] = useState(false)
  const [loginRole, setLoginRole] = useState<'rider' | 'insurer'>('rider')
  const [riderMode, setRiderMode] = useState<'signin' | 'signup'>('signin')

  // Rider fields
  const [mobile, setMobile] = useState('')
  const [riderName, setRiderName] = useState('')

  // Insurer fields
  const [email, setEmail] = useState('admin@shieldride.in')
  const [password, setPassword] = useState('shield2026')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ─── Rider Sign Up ───
  const handleRiderSignup = async () => {
    if (mobile.length !== 10) { setError('Enter a valid 10-digit mobile number'); return }
    if (!riderName.trim() || riderName.trim().length < 2) { setError('Please enter your full name'); return }
    setLoading(true)
    setError('')
    try {
      const res = await authApi.signup({
        name: riderName.trim(),
        mobile_number: mobile,
        assigned_store_id: 'BLK-BLR-047' // Will be updated during onboarding
      })
      // Save session
      sessionStore.save({
        role: 'rider',
        rider_id: res.data.rider_id,
        name: res.data.name,
        mobile_number: mobile,
        assigned_store_id: res.data.assigned_store_id,
        has_active_policy: false
      })
      setLoading(false)
      navigate('/onboarding')
    } catch (err: any) {
      setLoading(false)
      const detail = err?.response?.data?.detail
      if (detail?.includes('already exists')) {
        setError('This number is already registered. Please sign in instead.')
      } else {
        // If backend is down, continue in demo mode
        sessionStore.save({
          role: 'rider',
          rider_id: `demo-${Date.now()}`,
          name: riderName.trim(),
          mobile_number: mobile,
          assigned_store_id: 'BLK-BLR-047',
          has_active_policy: false
        })
        navigate('/onboarding')
      }
    }
  }

  // ─── Rider Sign In ───
  const handleRiderSignin = async () => {
    if (mobile.length !== 10) { setError('Enter a valid 10-digit mobile number'); return }
    setLoading(true)
    setError('')
    try {
      const res = await authApi.signin({ mobile_number: mobile })
      sessionStore.save({
        role: 'rider',
        rider_id: res.data.rider_id,
        name: res.data.name,
        mobile_number: mobile,
        assigned_store_id: res.data.assigned_store_id,
        has_active_policy: res.data.has_active_policy
      })
      setLoading(false)
      if (res.data.has_active_policy) {
        navigate('/dashboard')
      } else {
        navigate('/onboarding')
      }
    } catch (err: any) {
      setLoading(false)
      const status = err?.response?.status
      if (status === 404) {
        setError('No account found. Please sign up first.')
      } else {
        // Backend down, demo mode
        sessionStore.save({
          role: 'rider',
          rider_id: `demo-${Date.now()}`,
          name: 'Demo Rider',
          mobile_number: mobile,
          assigned_store_id: 'BLK-BLR-047',
          has_active_policy: false
        })
        navigate('/onboarding')
      }
    }
  }

  // ─── Insurer Login ───
  const handleInsurerLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await authApi.insurerLogin({ email, password })
      sessionStore.save({
        role: 'insurer',
        user_id: res.data.user_id,
        name: res.data.name,
        email
      })
      setLoading(false)
      navigate('/insurer')
    } catch (err: any) {
      // Try local validation fallback
      if (email === 'admin@shieldride.in' && password === 'shield2026') {
        sessionStore.save({
          role: 'insurer',
          user_id: 'insurer-admin-001',
          name: 'ShieldRide Admin',
          email
        })
        setLoading(false)
        navigate('/insurer')
      } else {
        setLoading(false)
        setError('Invalid credentials. Demo: admin@shieldride.in / shield2026')
      }
    }
  }

  return (
    <>
      <div className="ambient-bg" />
      <AnimatePresence mode="wait">
        {!showLogin ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="landing-container"
          >
            {/* Logo & Hero */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="icon-circle" style={{ width: 88, height: 88, marginBottom: '2rem' }}>
                <Shield size={44} />
              </div>
            </motion.div>

            <motion.h1 className="heading-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              ShieldRide
            </motion.h1>

            <motion.p className="text-body" style={{ maxWidth: 520, margin: '1rem auto 0', fontSize: '1.1rem' }}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              AI-Powered Parametric Income Protection for Blinkit Delivery Partners.
              <br />
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                Zero claim forms. Auto-payouts in under 2 minutes.
              </span>
            </motion.p>

            {/* Role Cards */}
            <motion.div className="role-cards" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              <div className="role-card" onClick={() => { setShowLogin(true); setLoginRole('rider'); setError('') }} id="rider-login-card">
                <span className="role-icon">🏍️</span>
                <div className="role-title">I'm a Rider</div>
                <div className="role-desc">Delivery partner login & onboarding</div>
                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                  <Bike size={16} /> Get Started <ArrowRight size={14} />
                </div>
              </div>

              <div className="role-card" onClick={() => { setShowLogin(true); setLoginRole('insurer'); setError('') }} id="insurer-login-card">
                <span className="role-icon">📊</span>
                <div className="role-title">I'm an Insurer</div>
                <div className="role-desc">Operations dashboard & analytics</div>
                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                  <BarChart3 size={16} /> Dashboard <ArrowRight size={14} />
                </div>
              </div>
            </motion.div>

            {/* Stats Strip */}
            <motion.div className="stats-strip" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <div className="stat-item"><div className="stat-value">2,847</div><div className="stat-label">Riders Protected</div></div>
              <div className="stat-item"><div className="stat-value">₹8.4L</div><div className="stat-label">Claims Paid</div></div>
              <div className="stat-item"><div className="stat-value">&lt;97s</div><div className="stat-label">Avg Payout Time</div></div>
              <div className="stat-item"><div className="stat-value">92.4%</div><div className="stat-label">Retention Rate</div></div>
            </motion.div>

            <motion.p style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
              Guidewire DEVTrails 2026 · Team AutoLearn · Amrita Vishwa Vidyapeetham
            </motion.p>
          </motion.div>
        ) : (
          /* ═══ LOGIN MODAL ═══ */
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="login-container">
            <motion.div className="login-card" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.4 }}>

              {/* Back Button */}
              <button onClick={() => { setShowLogin(false); setError('') }}
                className="btn btn-secondary btn-sm" style={{ marginBottom: '1.5rem', width: 'auto', padding: '0.4rem 1rem' }}>
                ← Back
              </button>

              {/* Brand */}
              <div className="text-center" style={{ marginBottom: '1.5rem' }}>
                <div className="icon-circle" style={{ margin: '0 auto 1rem', width: 56, height: 56 }}>
                  <Shield size={28} />
                </div>
                <h2 className="heading-lg">Welcome to ShieldRide</h2>
                <p className="text-sm" style={{ marginTop: '0.35rem' }}>
                  {loginRole === 'rider' ? 'Rider Account' : 'Insurer Operations Login'}
                </p>
              </div>

              {/* Role Tabs */}
              <div className="login-tabs">
                <button className={`login-tab ${loginRole === 'rider' ? 'active' : ''}`}
                  onClick={() => { setLoginRole('rider'); setError('') }}>
                  🏍️ Rider
                </button>
                <button className={`login-tab ${loginRole === 'insurer' ? 'active' : ''}`}
                  onClick={() => { setLoginRole('insurer'); setError('') }}>
                  📊 Insurer
                </button>
              </div>

              {/* ═══ RIDER FORM ═══ */}
              {loginRole === 'rider' ? (
                <div>
                  {/* Sign In / Sign Up Toggle */}
                  <div className="login-tabs" style={{ marginBottom: '1rem' }}>
                    <button className={`login-tab ${riderMode === 'signin' ? 'active' : ''}`}
                      onClick={() => { setRiderMode('signin'); setError('') }}
                      style={{ fontSize: '0.8rem' }}>
                      Sign In
                    </button>
                    <button className={`login-tab ${riderMode === 'signup' ? 'active' : ''}`}
                      onClick={() => { setRiderMode('signup'); setError('') }}
                      style={{ fontSize: '0.8rem' }}>
                      Sign Up (New)
                    </button>
                  </div>

                  {/* Name field — only for signup */}
                  {riderMode === 'signup' && (
                    <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                      <User size={18} style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }} />
                      <input
                        type="text" className="input-field" placeholder="Your full name"
                        value={riderName} onChange={e => setRiderName(e.target.value)}
                        autoFocus id="rider-name-input"
                      />
                    </div>
                  )}

                  {/* Mobile number */}
                  <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                    <Phone size={18} style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }} />
                    <span className="input-prefix">+91</span>
                    <input
                      type="tel" className="input-field" placeholder="Enter mobile number"
                      value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      autoFocus={riderMode === 'signin'} id="rider-mobile-input"
                    />
                  </div>

                  {error && (
                    <p style={{ color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                      ⚠ {error}
                    </p>
                  )}

                  <button className="btn btn-primary"
                    onClick={riderMode === 'signup' ? handleRiderSignup : handleRiderSignin}
                    disabled={mobile.length !== 10 || loading || (riderMode === 'signup' && riderName.trim().length < 2)}
                    id="rider-login-btn">
                    {loading
                      ? <><span className="spinner" /> {riderMode === 'signup' ? 'Creating Account...' : 'Signing In...'}</>
                      : riderMode === 'signup'
                        ? <>Create Account & Continue <ArrowRight size={18} /></>
                        : <>Sign In <ArrowRight size={18} /></>
                    }
                  </button>

                  <p className="text-xs text-center" style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                    {riderMode === 'signin'
                      ? <>Don't have an account? <button onClick={() => { setRiderMode('signup'); setError('') }} style={{ color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', fontSize: 'inherit' }}>Sign Up</button></>
                      : <>Already registered? <button onClick={() => { setRiderMode('signin'); setError('') }} style={{ color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', fontSize: 'inherit' }}>Sign In</button></>
                    }
                  </p>
                </div>
              ) : (
                /* ═══ INSURER FORM ═══ */
                <div>
                  <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                    <Mail size={18} style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }} />
                    <input type="email" className="input-field" placeholder="Email address"
                      value={email} onChange={e => setEmail(e.target.value)} id="insurer-email-input" />
                  </div>
                  <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                    <Lock size={18} style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }} />
                    <input type={showPassword ? 'text' : 'password'} className="input-field" placeholder="Password"
                      value={password} onChange={e => setPassword(e.target.value)} id="insurer-password-input" />
                    <button onClick={() => setShowPassword(!showPassword)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {error && (
                    <p style={{ color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                      ⚠ {error}
                    </p>
                  )}

                  <p className="text-xs" style={{ color: 'var(--accent-warning)', marginBottom: '1.25rem', fontWeight: 600 }}>
                    💡 Demo: admin@shieldride.in / shield2026
                  </p>

                  <button className="btn btn-primary" onClick={handleInsurerLogin}
                    disabled={!email || !password || loading} id="insurer-login-btn">
                    {loading ? <><span className="spinner" /> Authenticating...</> : <>Access Dashboard <BarChart3 size={18} /></>}
                  </button>
                </div>
              )}

              <div className="divider"><span>Secured by ShieldRide</span></div>

              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                {loginRole === 'rider'
                  ? 'Your data is encrypted and stored securely.'
                  : 'Enterprise-grade security. All sessions are monitored.'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
