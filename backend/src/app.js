require('dotenv').config({ path: __dirname + '/../../.env' });

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Infrastructure
const DIContainer = require('./infrastructure/container/DIContainer');
const { router: apiRoutes, setControllers } = require('./presentation/routes/apiRoutes');
const errorHandler = require('./infrastructure/middleware/errorHandler');

// Initialize DI Container
const container = new DIContainer();

// Setup controllers in routes
setControllers(container.getControllers());

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Security Control Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'Using default'}`);
  console.log(`🤖 Groq API: ${process.env.GROQ_API_KEY ? 'Configured' : 'Not configured (using fallback)'}`);
  console.log(`👤 Admin PIN: ${process.env.ADMIN_PIN || '0000'}`);
});

module.exports = app;
