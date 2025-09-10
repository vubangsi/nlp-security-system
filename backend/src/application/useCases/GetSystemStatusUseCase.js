class GetSystemStatusUseCase {
  constructor(systemStateRepository) {
    this.systemStateRepository = systemStateRepository;
  }

  async execute() {
    try {
      const systemState = await this.systemStateRepository.get();
      
      return {
        success: true,
        message: 'System status retrieved successfully',
        systemState: systemState.getStatus()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = GetSystemStatusUseCase;
