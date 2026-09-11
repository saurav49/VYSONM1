type LeaderboardBroadcaster = () => Promise<void>;

let broadcaster: LeaderboardBroadcaster = async () => undefined;

function registerLeaderboardBroadcaster(nextBroadcaster: LeaderboardBroadcaster) {
  broadcaster = nextBroadcaster;
}

function broadcastLeaderboard() {
  return broadcaster();
}

export { broadcastLeaderboard, registerLeaderboardBroadcaster };
