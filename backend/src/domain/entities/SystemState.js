class SystemState {
  constructor() {
    this.armed = false;
    this.mode = null; // 'away' or 'stay'
    this.lastModified = new Date();
    this.modifiedBy = null;
  }

  arm(mode, userId) {
    if (!['away', 'stay'].includes(mode)) {
      throw new Error('Invalid arm mode. Must be "away" or "stay"');
    }
    
    this.armed = true;
    this.mode = mode;
    this.lastModified = new Date();
    this.modifiedBy = userId;
  }

  disarm(userId) {
    this.armed = false;
    this.mode = null;
    this.lastModified = new Date();
    this.modifiedBy = userId;
  }

  isArmed() {
    return this.armed;
  }

  getStatus() {
    return {
      armed: this.armed,
      mode: this.mode,
      lastModified: this.lastModified,
      modifiedBy: this.modifiedBy
    };
  }
}

module.exports = SystemState;
