// Shared in-memory map: serverId -> AFK channelId
// The AFK channel is created on demand and deleted when empty.
const afkChannels = new Map();
module.exports = afkChannels;
