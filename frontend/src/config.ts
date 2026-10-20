// Configuration for Backend API and WebSocket URLs
// Supports local development, custom hostnames, Vercel, and Electron Desktop App

const CLOUD_API_URL = 'https://8.231.74.188.sslip.io';
const CLOUD_WS_URL = 'wss://8.231.74.188.sslip.io';

const isElectron = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'file:' ||
    Boolean((window as any).process?.versions?.electron) ||
    window.navigator.userAgent.includes('Electron')
  );
};

const getEnvBackendUrl = (): string => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return (import.meta.env.VITE_BACKEND_URL as string).replace(/\/$/, '');
  }

  // Desktop App connects to Cloud backend so friends can run it without needing Python installed
  if (isElectron()) {
    return CLOUD_API_URL;
  }

  // If on Vercel, use relative paths so Vercel rewrites proxy /api directly to the backend
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return '';
  }

  // If running in browser and not on localhost, use current hostname on port 5001
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${proto}//${window.location.hostname}:5001`;
  }

  return 'http://127.0.0.1:5001';
};

const getEnvWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return (import.meta.env.VITE_WS_URL as string).replace(/\/$/, '');
  }

  // Desktop App connects to secure WebSocket on Cloud backend
  if (isElectron()) {
    return CLOUD_WS_URL;
  }

  // If on Vercel (HTTPS), connect to the secure SSL domain on Google Cloud
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return CLOUD_WS_URL;
  }

  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${window.location.hostname}:5001`;
  }

  return 'ws://127.0.0.1:5001';
};

export const API_BASE_URL = getEnvBackendUrl();
export const WS_BASE_URL = getEnvWsUrl();

