class LoginUseCase {
  constructor(userRepository, authService) {
    this.userRepository = userRepository;
    this.authService = authService;
  }

  async execute(pin) {
    try {
      const user = await this.userRepository.findByPin(pin);
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      const token = this.authService.authenticateUser(user, pin);
      
      return {
        success: true,
        token,
        user: user.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = LoginUseCase;
