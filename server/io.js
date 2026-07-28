// Shared io instance so routes can emit socket events
let _io = null;

module.exports = {
  setIo: (io) => { _io = io; },
  getIo: () => _io,
};
