import app from './app';
import { config } from './config/env';
// import { WebSocketServer } from 'ws';
import http from 'http';
import { getAnalytics } from './modules/analytics/analytics.service';
import { findUser } from './modules/users/users.repository';
import { Server } from 'socket.io';
import { Tier } from './utils/enums';
import { registerLeaderboardBroadcaster } from './utils/leaderboard-broadcast';

export async function broadcastLeaderboard() {
  const leaderboard = await getAnalytics();
  // wss.clients.forEach((client) => {
  //   if (client.readyState === client.OPEN) {
  //     client.send(
  //       JSON.stringify({
  //         event: 'leaderboard_update',
  //         data: leaderboard,
  //       }),
  //     );
  //   }
  // });
  io.emit('leaderboard_update', leaderboard);
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
  },
});

registerLeaderboardBroadcaster(broadcastLeaderboard);

io.use(async (socket, next) => {
  const apiKey = socket.handshake.auth.apiKey;

  const user = await findUser({
    apiKey,
  });

  if (!user) {
    return next(new Error('Unauthorized'));
  }

  if (user.tier !== Tier.ENTERPRISE) {
    return next(
      new Error('Forbidden, Live leaderboard requires enterprise plan'),
    );
  }

  next();
});

io.on('connection', async (socket) => {
  console.log('socket io connected', socket.id);

  const leaderboard = await getAnalytics();
  socket.emit('leaderboard_update', leaderboard);

  socket.on('getLeaderboard', async () => {
    const leaderboard = await getAnalytics();
    socket.emit('leaderboard_update', leaderboard);
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO client disconnected:', socket.id);
  });
});

// const wss = new WebSocketServer({
//   server,
//   path: '/ws/leaderboard',
// });

// wss.on('connection', async (socket, req) => {
//   const url = new URL(req.url ?? '', 'http://localhost');
//   const apiKey = url.searchParams.get('apiKey');

//   const user = await findUser({
//     apiKey: apiKey ?? '',
//   });
//   if (!user) {
//     socket.close(1008, 'unauthorized');
//     return;
//   }
//   if (user.tier === 'HOBBY') {
//     socket.send(
//       JSON.stringify({
//         event: 'error',
//         message: 'Live leaderboard requires enterprise plan',
//       }),
//     );
//     socket.close(1008, 'Forbidden');
//   }
//   socket.send(
//     JSON.stringify({
//       type: 'info',
//       message: 'Connected to websocket',
//     }),
//   );

//   await broadcastLeaderboard();

//   socket.on('close', () => {
//     console.log('Client disconnected');
//   });
// });

const PORT = config.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
