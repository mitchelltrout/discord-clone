// Lightweight signal so any component can tell AppShell to show the chat panel on mobile.
let _setShowChat = null;

export function registerMobileShowChat(fn) {
  _setShowChat = fn;
}

export function showMobileChat() {
  _setShowChat?.(true);
}
