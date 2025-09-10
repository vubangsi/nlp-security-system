import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Authentication
  login: async (pin) => {
    const response = await api.post('/login', { pin });
    return response.data;
  },

  // Commands
  sendCommand: async (command) => {
    const response = await api.post('/command', { command });
    return response.data;
  },

  // Users
  addUser: async (name, pin) => {
    const response = await api.post('/users', { name, pin });
    return response.data;
  },

  listUsers: async () => {
    const response = await api.get('/users');
    return response.data;
  },

  // System
  getSystemState: async () => {
    const response = await api.get('/system/state');
    return response.data;
  },

  getEventLogs: async (limit = 50) => {
    const response = await api.get(`/system/events?limit=${limit}`);
    return response.data;
  },

  clearEventLogs: async () => {
    const response = await api.delete('/system/events');
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await api.get('/healthz');
    return response.data;
  },
};

export default apiService;
