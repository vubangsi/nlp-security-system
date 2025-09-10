import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SystemStatus from '../SystemStatus';

describe('SystemStatus Component', () => {
  test('renders armed status correctly', () => {
    const systemState = {
      armed: true,
      mode: 'away',
      lastModified: '2023-01-01T12:00:00Z',
      modifiedBy: 'admin'
    };

    render(<SystemStatus systemState={systemState} />);

    expect(screen.getByText('🔒 ARMED')).toBeInTheDocument();
    expect(screen.getByText('Mode: away')).toBeInTheDocument();
    expect(screen.getByText(/Modified by: admin/)).toBeInTheDocument();
  });

  test('renders disarmed status correctly', () => {
    const systemState = {
      armed: false,
      mode: 'disarmed',
      lastModified: '2023-01-01T12:00:00Z',
      modifiedBy: 'user'
    };

    render(<SystemStatus systemState={systemState} />);

    expect(screen.getByText('🔓 DISARMED')).toBeInTheDocument();
    expect(screen.getByText('Mode: disarmed')).toBeInTheDocument();
    expect(screen.getByText(/Modified by: user/)).toBeInTheDocument();
  });

  test('renders loading state when no system state provided', () => {
    render(<SystemStatus systemState={null} />);

    expect(screen.getByText('Loading system status...')).toBeInTheDocument();
  });

  test('applies correct CSS classes for armed state', () => {
    const systemState = {
      armed: true,
      mode: 'away',
      lastModified: '2023-01-01T12:00:00Z',
      modifiedBy: 'admin'
    };

    const { container } = render(<SystemStatus systemState={systemState} />);
    const statusElement = container.querySelector('.system-status');
    
    expect(statusElement).toHaveClass('armed');
  });

  test('applies correct CSS classes for disarmed state', () => {
    const systemState = {
      armed: false,
      mode: 'disarmed',
      lastModified: '2023-01-01T12:00:00Z',
      modifiedBy: 'user'
    };

    const { container } = render(<SystemStatus systemState={systemState} />);
    const statusElement = container.querySelector('.system-status');
    
    expect(statusElement).toHaveClass('disarmed');
  });

  test('formats timestamp correctly', () => {
    const systemState = {
      armed: true,
      mode: 'away',
      lastModified: '2023-01-01T12:00:00Z',
      modifiedBy: 'admin'
    };

    render(<SystemStatus systemState={systemState} />);

    // Check that the timestamp is formatted and displayed
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });
});
