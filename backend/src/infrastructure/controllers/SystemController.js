class SystemController {
  constructor(systemStateRepository, eventLogRepository) {
    this.systemStateRepository = systemStateRepository;
    this.eventLogRepository = eventLogRepository;
  }

  async getSystemState(req, res, next) {
    try {
      const systemState = await this.systemStateRepository.get();
      res.json({
        success: true,
        systemState: systemState.getStatus()
      });
    } catch (error) {
      next(error);
    }
  }

  async getEventLogs(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const eventLogs = await this.eventLogRepository.findRecent(limit);
      
      res.json({
        success: true,
        eventLogs: eventLogs.map(log => log.toJSON())
      });
    } catch (error) {
      next(error);
    }
  }

  async clearEventLogs(req, res, next) {
    try {
      await this.eventLogRepository.clear();
      res.json({
        success: true,
        message: 'Event logs cleared'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SystemController;
