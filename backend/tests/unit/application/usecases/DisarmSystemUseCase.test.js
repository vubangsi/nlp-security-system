const DisarmSystemUseCase = require('../../../../src/application/useCases/DisarmSystemUseCase');
const SystemState = require('../../../../src/domain/entities/SystemState');

describe('DisarmSystemUseCase', () => {
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

    useCase = new DisarmSystemUseCase(mockSystemStateRepository, mockEventLogRepository, mockEventBus);
  });

  describe('execute', () => {
    test('should disarm system successfully when armed', async () => {
      const armedState = new SystemState();
      armedState.arm('away', 'admin'); // Arm it first
      mockSystemStateRepository.get.mockResolvedValue(armedState);
      mockSystemStateRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute('admin');

      expect(result.success).toBe(true);
      expect(result.message).toBe('System disarmed');
      expect(result.systemState.armed).toBe(false);
      expect(result.systemState.mode).toBe(null);
      expect(result.systemState.modifiedBy).toBe('admin');

      expect(mockSystemStateRepository.save).toHaveBeenCalledWith(armedState);
      expect(mockEventLogRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    test('should fail when system is already disarmed', async () => {
      const disarmedState = new SystemState(false, 'disarmed');
      mockSystemStateRepository.get.mockResolvedValue(disarmedState);

      const result = await useCase.execute('admin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('System is already disarmed');
      expect(mockSystemStateRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should handle repository errors', async () => {
      mockSystemStateRepository.get.mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute('admin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});
