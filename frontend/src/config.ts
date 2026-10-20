// Configuration for Backend API and WebSocket URLs
// Supports local development, custom hostnames, and Vercel environment variables

const getEnvBackendUrl = (): string => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return (import.meta.env.VITE_BACKEND_URL as string).replace(/\/$/, '');
  }

  // If running in browser and not on localhost, use current hostname on port 5001
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    // If deployed on Vercel and no env var provided, fallback to current or default
    return `${proto}//${window.location.hostname}:5001`;
  }

  return 'http://127.0.0.1:5001';
};

const getEnvWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return (import.meta.env.VITE_WS_URL as string).replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${window.location.hostname}:5001`;
  }

  return 'ws://127.0.0.1:5001';
};

export const API_BASE_URL = getEnvBackendUrl();
export const WS_BASE_URL = getEnvWsUrl();
