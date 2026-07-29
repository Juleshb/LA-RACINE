import { Server } from 'socket.io';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    socket.on('join_inquiry', (inquiryId) => {
      if (!inquiryId) return;
      socket.join(`inquiry:${inquiryId}`);
    });

    socket.on('leave_inquiry', (inquiryId) => {
      if (!inquiryId) return;
      socket.leave(`inquiry:${inquiryId}`);
    });

    socket.on('join_admin_contact', () => {
      socket.join('admin:contact');
    });

    socket.on('typing', (payload = {}) => {
      const inquiryId = payload.inquiryId;
      if (!inquiryId) return;
      socket.to(`inquiry:${inquiryId}`).emit('typing', {
        inquiryId,
        name: payload.name || 'Someone',
        role: payload.role || 'visitor',
        isTyping: Boolean(payload.isTyping),
      });
      // Also notify admin list panel if staff not in room yet
      socket.to('admin:contact').emit('typing', {
        inquiryId,
        name: payload.name || 'Someone',
        role: payload.role || 'visitor',
        isTyping: Boolean(payload.isTyping),
      });
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitInquiryUpdate(inquiry) {
  if (!io || !inquiry?.id) return;
  io.to(`inquiry:${inquiry.id}`).emit('inquiry_updated', inquiry);
  io.to('admin:contact').emit('inquiry_updated', inquiry);
}

export function emitInquiryCreated(inquiry) {
  if (!io || !inquiry?.id) return;
  io.to('admin:contact').emit('inquiry_created', inquiry);
}
