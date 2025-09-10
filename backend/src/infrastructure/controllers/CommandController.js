class CommandController {
  constructor(processCommandUseCase) {
    this.processCommandUseCase = processCommandUseCase;
  }

  async processCommand(req, res, next) {
    try {
      const { command } = req.body;
      const userId = req.user.id;
      
      if (!command) {
        return res.status(400).json({
          success: false,
          message: 'Command is required'
        });
      }

      const result = await this.processCommandUseCase.execute(command, userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CommandController;
