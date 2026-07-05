import app from './app';
import { config } from './config/env';
import { WebSocketServer } from 'ws';
import http from 'http';
import { getAnalytics } from './modules/analytics/analytics.service';
import { findUser } from './modules/users/users.repository';

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: '/ws/leaderboard',
});

export async function broadcastLeaderboard() {
  const leaderboard = await getAnalytics();
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(
        JSON.stringify({
          event: 'leaderboard_update',
          data: leaderboard,
        }),
      );
    }
  });
}

wss.on('connection', async (socket, req) => {
  const url = new URL(req.url ?? '', 'http://localhost');
  const apiKey = url.searchParams.get('apiKey');

  const user = await findUser({
    apiKey: apiKey ?? '',
  });
  if (!user) {
    socket.close(1008, 'unauthorized');
    return;
  }
  if (user.tier === 'HOBBY') {
    socket.send(
      JSON.stringify({
        event: 'error',
        message: 'Live leaderboard requires enterprise plan',
      }),
    );
    socket.close(1008, 'Forbidden');
  }
  socket.send(
    JSON.stringify({
      type: 'info',
      message: 'Connected to websocket',
    }),
  );

  await broadcastLeaderboard();

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});

const PORT = config.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
