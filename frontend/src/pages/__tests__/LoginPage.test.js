import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import LoginPage from '../LoginPage';
import * as authService from '../../services/authService';

// Mock the auth service
jest.mock('../../services/authService');

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock auth utility
jest.mock('../../utils/auth', () => ({
  setAuthToken: jest.fn(),
  dispatchAuthEvent: jest.fn(),
}));

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('LoginPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login form correctly', () => {
    renderWithRouter(<LoginPage />);

    expect(screen.getByText('🔐 Security Control System')).toBeInTheDocument();
    expect(screen.getByLabelText('Enter PIN:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  test('handles successful login', async () => {
    const mockLoginResponse = {
      success: true,
      token: 'test-token',
      user: { id: 'admin', name: 'Admin', role: 'admin' }
    };

    authService.login.mockResolvedValue(mockLoginResponse);

    renderWithRouter(<LoginPage />);

    const pinInput = screen.getByLabelText('Enter PIN:');
    const loginButton = screen.getByRole('button', { name: 'Login' });

    fireEvent.change(pinInput, { target: { value: '0000' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('0000');
      expect(mockNavigate).toHaveBeenCalledWith('/command', { replace: true });
    });
  });

  test('handles login failure', async () => {
    const mockLoginResponse = {
      success: false,
      error: 'Invalid PIN'
    };

    authService.login.mockResolvedValue(mockLoginResponse);

    renderWithRouter(<LoginPage />);

    const pinInput = screen.getByLabelText('Enter PIN:');
    const loginButton = screen.getByRole('button', { name: 'Login' });

    fireEvent.change(pinInput, { target: { value: '1234' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid PIN')).toBeInTheDocument();
    });
  });

  test('shows loading state during login', async () => {
    authService.login.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderWithRouter(<LoginPage />);

    const pinInput = screen.getByLabelText('Enter PIN:');
    const loginButton = screen.getByRole('button', { name: 'Login' });

    fireEvent.change(pinInput, { target: { value: '0000' } });
    fireEvent.click(loginButton);

    expect(screen.getByText('Logging in...')).toBeInTheDocument();
    expect(loginButton).toBeDisabled();
  });

  test('validates PIN input', () => {
    renderWithRouter(<LoginPage />);

    const pinInput = screen.getByLabelText('Enter PIN:');
    const loginButton = screen.getByRole('button', { name: 'Login' });

    // Test empty PIN
    fireEvent.click(loginButton);
    expect(authService.login).not.toHaveBeenCalled();

    // Test valid PIN
    fireEvent.change(pinInput, { target: { value: '0000' } });
    expect(pinInput.value).toBe('0000');
  });

  test('handles network errors', async () => {
    authService.login.mockRejectedValue(new Error('Network error'));

    renderWithRouter(<LoginPage />);

    const pinInput = screen.getByLabelText('Enter PIN:');
    const loginButton = screen.getByRole('button', { name: 'Login' });

    fireEvent.change(pinInput, { target: { value: '0000' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
  });

  test('allows PIN input via keyboard', () => {
    renderWithRouter(<LoginPage />);

    const pinInput = screen.getByLabelText('Enter PIN:');

    fireEvent.change(pinInput, { target: { value: '1234' } });
    expect(pinInput.value).toBe('1234');

    fireEvent.keyDown(pinInput, { key: 'Backspace' });
    fireEvent.change(pinInput, { target: { value: '123' } });
    expect(pinInput.value).toBe('123');
  });
});
