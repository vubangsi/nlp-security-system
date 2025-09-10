const jwt = require('jsonwebtoken');

class AuthenticationService {
  constructor(jwtSecret) {
    this.jwtSecret = jwtSecret;
  }

  generateToken(user) {
    const payload = {
      user: {
        id: user.id,
        role: user.role,
        name: user.name
      }
    };
    
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '1h' });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  authenticateUser(user, inputPin) {
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.validatePin(inputPin)) {
      throw new Error('Invalid PIN');
    }

    return this.generateToken(user);
  }
}

module.exports = AuthenticationService;
