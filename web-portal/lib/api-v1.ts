import axios from 'axios';

/** Resolves `/api/v1` from `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:3001/api`). */
function v1BaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const trimmed = base.replace(/\/+$/, '');
  if (trimmed.endsWith('/api')) {
    return `${trimmed}/v1`;
  }
  return `${trimmed}/v1`;
}

export const apiV1 = axios.create({
  baseURL: v1BaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiV1.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiV1.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
