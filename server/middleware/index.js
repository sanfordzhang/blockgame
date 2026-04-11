const express = require('express');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
// const helmet = require('helmet');
const xssClean = require('xss-clean');
const expressRateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');
const { corsOptions } = require('./corsConfig');
const logger = require('./logger');

const configureMiddleware = (app) => {
  // Body-parser middleware
  app.use(express.json());

  // Cookie Parser
  app.use(cookieParser());

  // MongoDB data sanitizer
  app.use(mongoSanitize());

  // Helmet improves API security by setting some additional header checks
  // app.use(helmet());

  // Additional protection against XSS attacks
  app.use(xssClean());

  // Add rate limit to API (1000 requests per 10 mins for development)
  app.use(
    expressRateLimit({
      windowMs: 10 * 60 * 1000,
      max: 1000, // Increased for AMM polling
    }),
  );

  // Prevent http param pollution
  app.use(hpp());

  // Enable dynamic CORS for localhost, LAN, tunnel, and configured origins
  app.use(cors(corsOptions));

  // Custom logging middleware
  app.use(logger);
};

module.exports = configureMiddleware;
