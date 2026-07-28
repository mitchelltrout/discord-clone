import axios from 'axios';

function getApiUrl() {
  if (typeof window === 'undefined') return 'http://localhost:4000/api';
  const { hostname, protocol } = window.location;
  const port = hostname === 'localhost' ? ':4000' : '';
  return `${protocol}//${hostname}${port}/api`;
}

function getApiBase() {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  const { hostname, protocol } = window.location;
  const port = hostname === 'localhost' ? ':4000' : '';
  return `${protocol}//${hostname}${port}`;
}

const api = axios.create({
  baseURL: getApiUrl(),
});

// Inject access token on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      try {
        const state = JSON.parse(raw);
        const token = state?.state?.accessToken;
        if (token) config.headers['Authorization'] = `Bearer ${token}`;
      } catch {}
    }
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const raw = localStorage.getItem('auth-storage');
        const state = JSON.parse(raw);
        const refreshToken = state?.state?.refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(
          `${getApiBase()}/api/auth/refresh`,
          { refreshToken }
        );
        const { useAuthStore } = await import('./stores/authStore');
        useAuthStore.getState().setAccessToken(data.accessToken);

        original.headers['Authorization'] = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        const { useAuthStore } = await import('./stores/authStore');
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function getMediaUrl(filePath) {
  if (!filePath) return null;
  if (filePath.startsWith('http')) return filePath;
  return `${getApiBase()}${filePath}`;
}

export default api;
