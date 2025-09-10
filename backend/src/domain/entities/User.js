class User {
  constructor(id, name, pin, role = 'user') {
    this.id = id;
    this.name = name;
    this.pin = pin;
    this.role = role; // 'admin' or 'user'
    this.createdAt = new Date();
  }

  isAdmin() {
    return this.role === 'admin';
  }

  validatePin(inputPin) {
    return this.pin === inputPin;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      createdAt: this.createdAt
      // Note: PIN is not included for security
    };
  }
}

module.exports = User;
