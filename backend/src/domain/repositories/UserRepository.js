// Domain Repository Interface
class UserRepository {
  async save(user) {
    throw new Error('Method not implemented');
  }

  async findById(id) {
    throw new Error('Method not implemented');
  }

  async findByPin(pin) {
    throw new Error('Method not implemented');
  }

  async findAll() {
    throw new Error('Method not implemented');
  }

  async delete(id) {
    throw new Error('Method not implemented');
  }

  async exists(pin) {
    throw new Error('Method not implemented');
  }
}

module.exports = UserRepository;
