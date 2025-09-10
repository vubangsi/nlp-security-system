import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import CommandPage from '../CommandPage';
import * as systemService from '../../services/systemService';
import * as commandService from '../../services/commandService';

// Mock services
jest.mock('../../services/systemService');
jest.mock('../../services/commandService');

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('CommandPage Component', () => {
  const mockSystemState = {
    armed: false,
    mode: 'disarmed',
    lastModified: '2023-01-01T12:00:00Z',
    modifiedBy: 'system'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    systemService.getSystemState.mockResolvedValue(mockSystemState);
  });

  test('renders command interface correctly', async () => {
    renderWithRouter(<CommandPage />);

    await waitFor(() => {
      expect(screen.getByText('🔐 Security Control System')).toBeInTheDocument();
      expect(screen.getByText('System Status')).toBeInTheDocument();
      expect(screen.getByText('Voice Commands')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter your command/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send Command' })).toBeInTheDocument();
    });
  });

  test('displays system status correctly', async () => {
    renderWithRouter(<CommandPage />);

    await waitFor(() => {
      expect(screen.getByText('🔓 DISARMED')).toBeInTheDocument();
      expect(screen.getByText('Mode: disarmed')).toBeInTheDocument();
    });
  });

  test('handles successful command execution', async () => {
    const mockCommandResponse = {
      success: true,
      command: 'arm system',
      intent: 'ARM_SYSTEM',
      result: {
        success: true,
        message: 'System armed in away mode',
        systemState: {
          armed: true,
          mode: 'away',
          lastModified: '2023-01-01T12:05:00Z',
          modifiedBy: 'admin'
        }
      }
    };

    commandService.sendCommand.mockResolvedValue(mockCommandResponse);
    systemService.getSystemState.mockResolvedValueOnce(mockSystemState)
      .mockResolvedValueOnce(mockCommandResponse.result.systemState);

    renderWithRouter(<CommandPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter your command/)).toBeInTheDocument();
    });

    const commandInput = screen.getByPlaceholderText(/Enter your command/);
    const sendButton = screen.getByRole('button', { name: 'Send Command' });

    fireEvent.change(commandInput, { target: { value: 'arm system' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(commandService.sendCommand).toHaveBeenCalledWith('arm system');
      expect(screen.getByText('System armed in away mode')).toBeInTheDocument();
    });
  });

  test('handles command execution failure', async () => {
    const mockCommandResponse = {
      success: true,
      command: 'arm system',
      intent: 'ARM_SYSTEM',
      result: {
        success: false,
        error: 'System is already armed'
      }
    };

    commandService.sendCommand.mockResolvedValue(mockCommandResponse);

    renderWithRouter(<CommandPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter your command/)).toBeInTheDocument();
    });

    const commandInput = screen.getByPlaceholderText(/Enter your command/);
    const sendButton = screen.getByRole('button', { name: 'Send Command' });

    fireEvent.change(commandInput, { target: { value: 'arm system' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('System is already armed')).toBeInTheDocument();
    });
  });

  test('shows loading state during command execution', async () => {
    commandService.sendCommand.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderWithRouter(<CommandPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter your command/)).toBeInTheDocument();
    });

    const commandInput = screen.getByPlaceholderText(/Enter your command/);
    const sendButton = screen.getByRole('button', { name: 'Send Command' });

    fireEvent.change(commandInput, { target: { value: 'arm system' } });
    fireEvent.click(sendButton);

    expect(screen.getByText('Sending...')).toBeInTheDocument();
    expect(sendButton).toBeDisabled();
  });

  test('validates command input', () => {
    renderWithRouter(<CommandPage />);

    const sendButton = screen.getByRole('button', { name: 'Send Command' });

    // Test empty command
    fireEvent.click(sendButton);
    expect(commandService.sendCommand).not.toHaveBeenCalled();
  });

  test('clears command input after successful execution', async () => {
    const mockCommandResponse = {
      success: true,
      command: 'status',
      intent: 'GET_STATUS',
      result: { success: true, message: 'Status retrieved' }
    };

    commandService.sendCommand.mockResolvedValue(mockCommandResponse);

    renderWithRouter(<CommandPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter your command/)).toBeInTheDocument();
    });

    const commandInput = screen.getByPlaceholderText(/Enter your command/);
    const sendButton = screen.getByRole('button', { name: 'Send Command' });

    fireEvent.change(commandInput, { target: { value: 'status' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(commandInput.value).toBe('');
    });
  });

  test('handles network errors gracefully', async () => {
    commandService.sendCommand.mockRejectedValue(new Error('Network error'));

    renderWithRouter(<CommandPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter your command/)).toBeInTheDocument();
    });

    const commandInput = screen.getByPlaceholderText(/Enter your command/);
    const sendButton = screen.getByRole('button', { name: 'Send Command' });

    fireEvent.change(commandInput, { target: { value: 'arm system' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to send command. Please try again.')).toBeInTheDocument();
    });
  });
});
