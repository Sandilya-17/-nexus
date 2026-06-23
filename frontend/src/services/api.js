import axios from 'axios';

const BACKEND_URL = 'https://nexus-production-42ab.up.railway.app';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `${BACKEND_URL}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = JSON.parse(localStorage.getItem('nexus-auth') || '{}')?.state?.token;
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const stored = JSON.parse(localStorage.getItem('nexus-auth') || '{}');
        const refreshToken = stored?.state?.refreshToken;
        if (refreshToken) {
          const { data } = await axios.post(`${BACKEND_URL}/api/auth/refresh-token`, { refreshToken });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
          original.headers.Authorization = `Bearer ${data.token}`;
          return api(original);
        }
      } catch (refreshError) {
        localStorage.removeItem('nexus-auth');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
