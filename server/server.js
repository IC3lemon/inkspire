const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e6,
});

app.use(express.static(path.join(__dirname, '..')));

const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      fps: 12,
      layers: [{ name: 'Layer 1', visible: true, opacity: 1 }],
      frames: [{ layerStrokes: [[]] }],
    });
  }
  return rooms.get(roomId);
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let userName = 'Anonymous';

  socket.on('join-room', (data) => {
    const roomId = String(data.roomId).slice(0, 32);
    userName = String(data.userName || 'Anonymous').slice(0, 32);
    if (currentRoom) socket.leave(currentRoom);
    currentRoom = roomId;
    socket.join(roomId);
    const room = getOrCreateRoom(roomId);
    socket.emit('room-state', room);
    socket.to(roomId).emit('user-joined', { id: socket.id, name: userName });
    const size = io.sockets.adapter.rooms.get(roomId)?.size ?? 1;
    console.log(`[${roomId}] ${userName} joined (${size} in room)`);
  });

  socket.on('stroke', (data) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (room) {
      const frame = room.frames[data.frameIdx];
      if (frame) {
        while (frame.layerStrokes.length <= data.layerIdx) frame.layerStrokes.push([]);
        frame.layerStrokes[data.layerIdx].push(data.stroke);
      }
    }
    socket.to(currentRoom).emit('stroke', data);
  });

  socket.on('frame-state-sync', (data) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (room) {
      room.fps = data.fps;
      room.layers = data.layers;
      room.frames = data.frames;
    }
    socket.to(currentRoom).emit('frame-state-sync', data);
  });

  socket.on('ping-latency', (ts) => {
    socket.emit('pong-latency', ts);
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      socket.to(currentRoom).emit('user-left', { id: socket.id });
      console.log(`[${currentRoom}] ${userName} left`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`inkspire collab server → http://localhost:${PORT}`);
});
