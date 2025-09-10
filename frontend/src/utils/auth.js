// Authentication utility functions

export const setAuthData = (token, userRole) => {
  localStorage.setItem('token', token);
  localStorage.setItem('userRole', userRole);
  
  // Dispatch custom event to notify App component of auth change
  window.dispatchEvent(new Event('authChange'));
};

export const clearAuthData = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userRole');
  
  // Dispatch custom event to notify App component of auth change
  window.dispatchEvent(new Event('authChange'));
};

export const getAuthData = () => {
  return {
    token: localStorage.getItem('token'),
    userRole: localStorage.getItem('userRole')
  };
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};
