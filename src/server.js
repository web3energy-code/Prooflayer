require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('../config/database');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  const server = http.createServer(app);

  // Socket.io for real-time messages, likes, comments
  const io = new Server(server, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Auth middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.wallet = decoded.walletAddress;
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Join a room named after their wallet so we can send them DMs
    if (socket.wallet) {
      socket.join(socket.wallet);
    }

    socket.on('disconnect', () => {});
  });

  // Make io accessible in controllers via req.app.get('io')
  app.set('io', io);

  server.listen(PORT, () => {
    console.log(`ProofLayer API running on port ${PORT}`);
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT',  () => server.close(() => process.exit(0)));
  process.on('unhandledRejection', (err) => { console.error(err); server.close(() => process.exit(1)); });
}

start();
