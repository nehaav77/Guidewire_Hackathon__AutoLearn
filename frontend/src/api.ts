import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Session Management ───
// Persist rider/insurer session in localStorage so users don't have to login again

export interface RiderSession {
  role: 'rider';
  rider_id: string;
  name: string;
  mobile_number: string;
  assigned_store_id: string;
  has_active_policy: boolean;
}

export interface InsurerSession {
  role: 'insurer';
  user_id: string;
  name: string;
  email: string;
}

export type Session = RiderSession | InsurerSession;

export const sessionStore = {
  save(session: Session) {
    localStorage.setItem('shieldride_session', JSON.stringify(session));
  },
  get(): Session | null {
    const raw = localStorage.getItem('shieldride_session');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  clear() {
    localStorage.removeItem('shieldride_session');
  },
  isRider(): boolean {
    const s = this.get();
    return s?.role === 'rider';
  },
  isInsurer(): boolean {
    const s = this.get();
    return s?.role === 'insurer';
  }
};


// ─── Typed API Functions ───

export const authApi = {
  signup: (data: { name: string; mobile_number: string; assigned_store_id: string }) =>
    api.post('/riders/signup', data),
  signin: (data: { mobile_number: string }) =>
    api.post('/riders/signin', { mobile_number: data.mobile_number }),
  insurerLogin: (data: { email: string; password: string }) =>
    api.post('/riders/login', { email: data.email, password: data.password, role: 'insurer' }),
};

export const riderApi = {
  onboard: (data: { mobile_number: string; assigned_store_id: string; name?: string }) =>
    api.post('/riders/onboard', data),
  createPolicy: (data: { rider_id: string; coverage_tier: string; daily_coverage: number; weekly_premium: number; store_id?: string }) =>
    api.post('/riders/policy', data),
  getStatus: (riderId: string) =>
    api.get(`/riders/${riderId}/status`),
  getPolicyDetails: (riderId: string) =>
    api.get(`/riders/${riderId}/policy`),
  calculatePremium: (data: { store_id: string; tenure_months: number; coverage_tier: string; month?: number; is_basement?: boolean }) =>
    api.post('/riders/calculate-premium', data),
  getPricingZones: () =>
    api.get('/riders/pricing/zones'),
  getNearestHubs: (data: { latitude: number; longitude: number }) =>
    api.post('/riders/hubs/nearest', data),
};

export const claimsApi = {
  getHistory: (riderId: string) =>
    api.get(`/claims/history/${riderId}`),
  getWeeklySummary: (riderId: string) =>
    api.get(`/claims/weekly-summary/${riderId}`),
  simulateTrigger: (data: { trigger_type: string; intensity: number; store_ids: string[]; duration_minutes: number }) =>
    api.post('/claims/simulate-trigger', data),
  getInsurerStats: () =>
    api.get('/claims/insurer/stats'),
  getActiveTriggers: () =>
    api.get('/claims/triggers/active'),
};

export const externalApi = {
  getWeather: (lat?: number, lon?: number) =>
    api.get('/external/weather', { params: { lat, lon } }),
  getAqi: (lat?: number, lon?: number) =>
    api.get('/external/aqi', { params: { lat, lon } }),
  getStoreStatus: (storeId: string) =>
    api.get(`/external/blinkit/store/${storeId}`),
  getApiStatus: () =>
    api.get('/external/status'),
};
