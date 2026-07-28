// Shared in-memory map: channelId -> Set of userIds currently in voice
const voiceRooms = new Map();

module.exports = voiceRooms;
