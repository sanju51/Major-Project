import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import User from './models/user.model.js';
import { generateResult } from './services/ai.service.js';

const port = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const onlineUsers = new Map();

// Socket auth middleware
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.split(' ')[1];

    const projectId = socket.handshake.query.projectId;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return next(new Error('Invalid projectId'));
    }

    socket.project = await projectModel.findById(projectId);

    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded) {
      return next(new Error('Authentication error'));
    }

    const user = await User.findOne({ email: decoded.email }).select('_id email username role');
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;

    next();
  } catch (error) {
    next(error);
  }
});

io.on('connection', (socket) => {
  socket.roomId = socket.project._id.toString();

  console.log('a user connected:', socket.user.email);

  socket.join(socket.roomId);

  // Track online users
  onlineUsers.set(socket.user._id.toString(), {
    ...socket.user.toObject(),
    socketId: socket.id,
  });

  // Notify room about user presence
  io.to(socket.roomId).emit('user-online', {
    userId: socket.user._id,
    user: socket.user,
  });

  // Send current online users to new user
  socket.emit('online-users', Array.from(onlineUsers.values()));

  socket.on('project-message', async (data) => {
    const message = data.message;

    const aiIsPresentInMessage = message.includes('@ai');

    // broadcast normal message to others
    socket.broadcast.to(socket.roomId).emit('project-message', data);

    if (aiIsPresentInMessage) {
      const prompt = message.replace('@ai', '');

      try {
        // 🔹 Call AI service
        const result = await generateResult(prompt);

      io.to(socket.roomId).emit('project-message', {
        message: result, // should be JSON string { text, fileTree? }
        sender: {
          _id: 'ai',
          email: 'AI',
          username: 'AI',
        },
      });
      } catch (err) {
        console.error('AI error in socket handler:', err);

        // 🔹 Build a safe fallback message similar to normal AI payload
        const fallbackPayload = JSON.stringify({
          text:
            'AI assistant is currently unavailable. ' +
            'Reason: quota exceeded or network error. ' +
            'Please try again later or contact the administrator.',
          fileTree: null,
        });

        io.to(socket.roomId).emit('project-message', {
          message: fallbackPayload,
          sender: {
            _id: 'ai',
            email: 'AI',
            username: 'AI',
          },
        });
      }

      return;
    }
  });

  // Real-time typing indicator
  socket.on('typing', (data) => {
    socket.broadcast.to(socket.roomId).emit('typing', {
      ...data,
      user: socket.user,
    });
  });

  socket.on('stop-typing', () => {
    socket.broadcast.to(socket.roomId).emit('stop-typing', {
      userId: socket.user._id,
    });
  });

  // Real-time task updates
  socket.on('task-created', (task) => {
    socket.broadcast.to(socket.roomId).emit('task-created', task);
  });

  socket.on('task-updated', (task) => {
    socket.broadcast.to(socket.roomId).emit('task-updated', task);
  });

  socket.on('task-deleted', (taskId) => {
    socket.broadcast.to(socket.roomId).emit('task-deleted', taskId);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.user.email);
    onlineUsers.delete(socket.user._id.toString());
    io.to(socket.roomId).emit('user-offline', {
      userId: socket.user._id,
    });
    socket.leave(socket.roomId);
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
