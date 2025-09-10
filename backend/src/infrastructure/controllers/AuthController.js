class AuthController {
  constructor(loginUseCase) {
    this.loginUseCase = loginUseCase;
  }

  async login(req, res, next) {
    try {
      const { pin } = req.body;
      
      if (!pin) {
        return res.status(400).json({
          success: false,
          message: 'PIN is required'
        });
      }

      const result = await this.loginUseCase.execute(pin);
      
      if (result.success) {
        res.json({
          success: true,
          token: result.token,
          user: result.user
        });
      } else {
        res.status(401).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
