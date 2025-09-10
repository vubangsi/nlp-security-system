const UserRepository = require('../../domain/repositories/UserRepository');
const User = require('../../domain/entities/User');

class InMemoryUserRepository extends UserRepository {
  constructor() {
    super();
    this.users = new Map();
    this.initializeAdminUser();
  }

  initializeAdminUser() {
    const adminPin = process.env.ADMIN_PIN || '0000';
    const adminUser = new User('admin', 'Admin', adminPin, 'admin');
    this.users.set(adminUser.pin, adminUser);
    this.users.set(adminUser.id, adminUser);
  }

  async save(user) {
    this.users.set(user.pin, user);
    this.users.set(user.id, user);
    return user;
  }

  async findById(id) {
    return this.users.get(id) || null;
  }

  async findByPin(pin) {
    return this.users.get(pin) || null;
  }

  async findAll() {
    const allUsers = Array.from(this.users.values());
    // Remove duplicates (since we store by both pin and id)
    const uniqueUsers = allUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    );
    return uniqueUsers;
  }

  async delete(id) {
    const user = await this.findById(id);
    if (user) {
      this.users.delete(user.pin);
      this.users.delete(user.id);
      return true;
    }
    return false;
  }

  async exists(pin) {
    return this.users.has(pin);
  }
}

module.exports = InMemoryUserRepository;
