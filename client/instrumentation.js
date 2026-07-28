export function register() {
  // Prepend timestamps to all server-side console output
  ['log', 'info', 'warn', 'error'].forEach((method) => {
    const orig = console[method].bind(console);
    console[method] = (...args) => {
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
      orig(`[${ts}]`, ...args);
    };
  });
}
