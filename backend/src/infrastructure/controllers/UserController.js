class UserController {
  constructor(addUserUseCase, listUsersUseCase) {
    this.addUserUseCase = addUserUseCase;
    this.listUsersUseCase = listUsersUseCase;
  }

  async addUser(req, res, next) {
    try {
      const { name, pin } = req.body;
      const requestingUserId = req.user.id;
      
      if (!name || !pin) {
        return res.status(400).json({
          success: false,
          message: 'Name and PIN are required'
        });
      }

      const result = await this.addUserUseCase.execute(name, pin, requestingUserId);
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  }

  async listUsers(req, res, next) {
    try {
      const requestingUserId = req.user.id;
      const result = await this.listUsersUseCase.execute(requestingUserId);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
