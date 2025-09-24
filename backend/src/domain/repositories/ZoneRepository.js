// Domain Repository Interface
class ZoneRepository {
  async save(zone) {
    throw new Error('Method not implemented');
  }

  async findById(id) {
    throw new Error('Method not implemented');
  }

  async findByName(name) {
    throw new Error('Method not implemented');
  }

  async findAll() {
    throw new Error('Method not implemented');
  }

  async findRootZones() {
    throw new Error('Method not implemented');
  }

  async findChildZones(parentZoneId) {
    throw new Error('Method not implemented');
  }

  async findArmedZones() {
    throw new Error('Method not implemented');
  }

  async findDisarmedZones() {
    throw new Error('Method not implemented');
  }

  async findZonesByMode(mode) {
    throw new Error('Method not implemented');
  }

  async delete(id) {
    throw new Error('Method not implemented');
  }

  async exists(id) {
    throw new Error('Method not implemented');
  }

  async nameExists(name, excludeId = null) {
    throw new Error('Method not implemented');
  }

  async hasChildZones(zoneId) {
    throw new Error('Method not implemented');
  }

  async getZoneHierarchy(rootZoneId) {
    throw new Error('Method not implemented');
  }

  async validateZoneHierarchy(parentZoneId, childZoneId) {
    throw new Error('Method not implemented');
  }

  async countZones() {
    throw new Error('Method not implemented');
  }

  async findZonesModifiedAfter(timestamp) {
    throw new Error('Method not implemented');
  }

  async findZonesModifiedBy(userId) {
    throw new Error('Method not implemented');
  }
}

module.exports = ZoneRepository;