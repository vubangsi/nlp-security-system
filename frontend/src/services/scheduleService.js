import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Create axios instance with default config for schedules
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

const scheduleService = {
  // Create a new schedule
  createSchedule: async (scheduleData) => {
    try {
      const response = await api.post('/schedules', scheduleData);
      return response.data;
    } catch (error) {
      console.error('Create schedule error:', error);
      throw error.response?.data || { message: 'Failed to create schedule' };
    }
  },

  // Get all schedules with optional filters and pagination
  getSchedules: async (filters = {}, pagination = {}) => {
    try {
      const params = new URLSearchParams();
      
      // Add filters
      if (filters.status) params.append('status', filters.status);
      if (filters.actionType) params.append('actionType', filters.actionType);
      if (filters.days) params.append('days', filters.days);
      if (filters.search) params.append('search', filters.search);
      
      // Add pagination
      if (pagination.page) params.append('page', pagination.page);
      if (pagination.limit) params.append('limit', pagination.limit);
      if (pagination.sortBy) params.append('sortBy', pagination.sortBy);
      if (pagination.sortOrder) params.append('sortOrder', pagination.sortOrder);

      const response = await api.get(`/schedules?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Get schedules error:', error);
      throw error.response?.data || { message: 'Failed to get schedules' };
    }
  },

  // Get a specific schedule by ID
  getSchedule: async (id) => {
    try {
      const response = await api.get(`/schedules/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get schedule error:', error);
      throw error.response?.data || { message: 'Failed to get schedule' };
    }
  },

  // Update an existing schedule
  updateSchedule: async (id, updates) => {
    try {
      const response = await api.put(`/schedules/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Update schedule error:', error);
      throw error.response?.data || { message: 'Failed to update schedule' };
    }
  },

  // Delete a schedule
  deleteSchedule: async (id) => {
    try {
      const response = await api.delete(`/schedules/${id}`);
      return response.data;
    } catch (error) {
      console.error('Delete schedule error:', error);
      throw error.response?.data || { message: 'Failed to delete schedule' };
    }
  },

  // Bulk operations on schedules
  bulkOperations: async (action, criteria) => {
    try {
      const response = await api.post('/schedules/bulk', {
        action,
        criteria
      });
      return response.data;
    } catch (error) {
      console.error('Bulk operation error:', error);
      throw error.response?.data || { message: 'Failed to perform bulk operation' };
    }
  },

  // Get schedule statistics
  getStatistics: async () => {
    try {
      const response = await api.get('/schedules/statistics');
      return response.data;
    } catch (error) {
      console.error('Get statistics error:', error);
      throw error.response?.data || { message: 'Failed to get statistics' };
    }
  },

  // Get upcoming scheduled executions
  getUpcoming: async (days = 7) => {
    try {
      const response = await api.get(`/schedules/upcoming?days=${days}`);
      return response.data;
    } catch (error) {
      console.error('Get upcoming schedules error:', error);
      throw error.response?.data || { message: 'Failed to get upcoming schedules' };
    }
  },

  // Test a schedule expression for validity
  testScheduleExpression: async (expression) => {
    try {
      const response = await api.post('/schedules/test-expression', {
        expression
      });
      return response.data;
    } catch (error) {
      console.error('Test expression error:', error);
      throw error.response?.data || { message: 'Failed to test expression' };
    }
  },

  // Toggle schedule active/inactive status
  toggleSchedule: async (id, active) => {
    try {
      const response = await api.patch(`/schedules/${id}/toggle`, {
        active
      });
      return response.data;
    } catch (error) {
      console.error('Toggle schedule error:', error);
      throw error.response?.data || { message: 'Failed to toggle schedule' };
    }
  },

  // Get execution history for a schedule
  getExecutionHistory: async (id, limit = 20) => {
    try {
      const response = await api.get(`/schedules/${id}/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Get execution history error:', error);
      throw error.response?.data || { message: 'Failed to get execution history' };
    }
  },

  // Execute a schedule immediately (manual trigger)
  executeNow: async (id) => {
    try {
      const response = await api.post(`/schedules/${id}/execute`);
      return response.data;
    } catch (error) {
      console.error('Execute now error:', error);
      throw error.response?.data || { message: 'Failed to execute schedule' };
    }
  }
};

export default scheduleService;