class ListUsersUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(requestingUserId) {
    try {
      const users = await this.userRepository.findAll();
      
      return {
        success: true,
        users: users.map(user => user.toJSON())
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ListUsersUseCase;
