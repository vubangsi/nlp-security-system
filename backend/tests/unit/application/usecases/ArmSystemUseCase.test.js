const ArmSystemUseCase = require('../../../../src/application/useCases/ArmSystemUseCase');
const SystemState = require('../../../../src/domain/entities/SystemState');

describe('ArmSystemUseCase', () => {
  let useCase;
  let mockSystemStateRepository;
  let mockEventLogRepository;
  let mockEventBus;

  beforeEach(() => {
    mockSystemStateRepository = {
      get: jest.fn(),
      save: jest.fn()
    };

    mockEventLogRepository = {
      save: jest.fn()
    };

    mockEventBus = {
      publish: jest.fn()
    };

    useCase = new ArmSystemUseCase(mockSystemStateRepository, mockEventLogRepository, mockEventBus);
  });

  describe('execute', () => {
    test('should arm system successfully when disarmed', async () => {
      const disarmedState = new SystemState();
      mockSystemStateRepository.get.mockResolvedValue(disarmedState);
      mockSystemStateRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute('away', 'admin');

      expect(result.success).toBe(true);
      expect(result.message).toBe('System armed in away mode');
      expect(result.systemState.armed).toBe(true);
      expect(result.systemState.mode).toBe('away');
      expect(result.systemState.modifiedBy).toBe('admin');

      expect(mockSystemStateRepository.save).toHaveBeenCalledWith(disarmedState);
      expect(mockEventLogRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    test('should fail when system is already armed', async () => {
      const armedState = new SystemState();
      armedState.arm('away', 'admin'); // Arm it first
      mockSystemStateRepository.get.mockResolvedValue(armedState);

      const result = await useCase.execute('stay', 'admin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('System is already armed');
      expect(mockSystemStateRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should fail with invalid mode', async () => {
      const disarmedState = new SystemState();
      mockSystemStateRepository.get.mockResolvedValue(disarmedState);

      const result = await useCase.execute('invalid', 'admin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid arm mode. Must be "away" or "stay"');
      expect(mockSystemStateRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should handle repository errors', async () => {
      mockSystemStateRepository.get.mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute('admin', 'away');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});
