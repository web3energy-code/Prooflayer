const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(morgan('dev'));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
}));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'ProofLayer API', time: new Date().toISOString() }));
app.get('/api', (req, res) => res.json({ message: 'ProofLayer API v1.0' }));

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/contributions', require('./routes/contributions'));
app.use('/api/leaderboard',   require('./routes/leaderboard'));
app.use('/api/messages',      require('./routes/messages'));
app.use('/api/reactions',     require('./routes/reactions'));

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate entry' });
  }
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Server error' });
});

module.exports = app;
