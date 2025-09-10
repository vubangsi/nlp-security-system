import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

export const login = async (pin) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/login`, { pin });
    
    if (response.data.success) {
      // Store token and user info
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Dispatch custom event for auth state change
      window.dispatchEvent(new CustomEvent('authStateChange', {
        detail: { isAuthenticated: true, user: response.data.user }
      }));
      
      return response.data;
    } else {
      throw new Error(response.data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error.response?.data?.error || error.message || 'Login failed';
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Dispatch custom event for auth state change
  window.dispatchEvent(new CustomEvent('authStateChange', {
    detail: { isAuthenticated: false, user: null }
  }));
};

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const getToken = () => {
  return localStorage.getItem('token');
};

export const isAuthenticated = () => {
  const token = getToken();
  const user = getCurrentUser();
  return !!(token && user);
};

export const isAdmin = () => {
  const user = getCurrentUser();
  return user?.role === 'admin';
};
