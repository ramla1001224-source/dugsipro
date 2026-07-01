/**
 * axiosInstance.js - Axios pre-configured with offline support
 *
 * GET  requests: Network → cache on success, return cache on failure
 * POST/PUT/PATCH/DELETE: If offline, save to IndexedDB queue; show success to UI
 *
 * Usage: import api from '../utils/axiosInstance'
 *        const res = await api.get('/api/students')
 */
import axios from 'axios';
import { enqueueRequest } from './offlineQueue';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

// Simple in-memory cache (also backed by sessionStorage)
const CACHE_PREFIX = 'dugsi_cache_';

function getCached(url) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    // Expire cache after 10 minutes
    if (Date.now() - ts > 10 * 60 * 1000) {
      sessionStorage.removeItem(CACHE_PREFIX + url);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(url, data) {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + url,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // sessionStorage full – silently ignore
  }
}

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor ───────────────────────────────────
api.interceptors.request.use(async (config) => {
  // Attach auth token if available
  if (typeof window !== 'undefined') {
    const school = localStorage.getItem('selectedSchool');
    const token =
      localStorage.getItem('token') ||
      (school ? JSON.parse(school)?.token : null);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const isOnline =
    typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isOnline) {
    if (config.method?.toUpperCase() === 'GET') {
      // Return cached data
      const cached = getCached(config.url);
      if (cached) {
        // Reject with a special "offline cached" signal
        return Promise.reject({
          __offlineCached: true,
          data: cached,
          config,
        });
      }
      // No cache – let it fail naturally
      return Promise.reject({
        __offlineNocache: true,
        config,
      });
    }

    // Mutation while offline → queue it
    const fullUrl = `${BASE_URL}${config.url}`;
    await enqueueRequest(
      config.method,
      fullUrl,
      config.data,
      config.headers
    );

    return Promise.reject({
      __offlineQueued: true,
      config,
      data: {
        success: true,
        offline: true,
        message: 'Saved offline. Will sync when online.',
      },
    });
  }

  return config;
});

// ── Response Interceptor ──────────────────────────────────
api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses
    if (response.config.method?.toUpperCase() === 'GET') {
      setCache(response.config.url, response.data);
    }
    return response;
  },
  async (error) => {
    // Handle our special offline signals
    if (error?.__offlineCached) {
      return Promise.resolve({ data: error.data, status: 200, offline: true });
    }
    if (error?.__offlineQueued) {
      return Promise.resolve({
        data: error.data,
        status: 200,
        offline: true,
        queued: true,
      });
    }
    if (error?.__offlineNocache) {
      return Promise.reject(
        new Error('Offline and no cached data available.')
      );
    }

    // Network failure fallback to cache for GET
    const isNetworkError =
      !error.response ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK';

    if (isNetworkError && error.config?.method?.toUpperCase() === 'GET') {
      const cached = getCached(error.config.url);
      if (cached) {
        return Promise.resolve({ data: cached, status: 200, offline: true });
      }
    }

    return Promise.reject(error);
  }
);

export default api;
