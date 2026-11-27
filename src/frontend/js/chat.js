/**
 * chat.js
 * ---------------------------------------------------------------------------
 * Floating AI menu assistant in the bottom-right corner.
 *
 *  - Opens / closes the chat window from the toggle button.
 *  - Sends user questions to POST /api/chat through api.js.
 *  - Shows a typing indicator while the assistant is thinking.
 *  - Renders recommended dishes as small cards under the assistant bubble.
 *
 * Styles live in css/chat.css.
 */

const state = {
  isOpen: false,
  isSending: false,
  hasUnread: false,
};

// DOM references, resolved once in initChat().
const els = {};

/**
 * Cache all widget elements. Returns false if the markup is missing so the
 * script fails silently on pages without the chat widget.
 */
function cacheElements() {
  els.toggleBtn = document.getElementById("chat-toggle-btn");
  els.badge = document.getElementById("chat-toggle-badge");
  els.window = document.getElementById("chat-window");
  els.closeBtn = document.getElementById("chat-close-btn");
  els.clearBtn = document.getElementById("chat-clear-btn");
  els.guardBar = document.getElementById("chat-guard-bar");
  els.messages = document.getElementById("chat-messages");
  els.suggestions = document.getElementById("chat-suggestions");
  els.form = document.getElementById("chat-form");
  els.input = document.getElementById("chat-input");
  els.sendBtn = document.getElementById("chat-send-btn");

  return Boolean(els.toggleBtn && els.window && els.messages && els.form && els.input);
}

/* --------------------------------------------------------------------------
   Open / close
   -------------------------------------------------------------------------- */

function setUnread(value) {
  state.hasUnread = value;
  if (els.badge) els.badge.classList.toggle("d-none", !value);
}

export function openChat() {
  if (state.isOpen) return;
  state.isOpen = true;
  els.window.classList.add("is-open");
  els.window.setAttribute("aria-hidden", "false");
  els.toggleBtn.classList.add("is-open");
  els.toggleBtn.setAttribute("aria-expanded", "true");
  els.toggleBtn.setAttribute("aria-label", "Close menu assistant chat");
  setUnread(false);

  // Wait for the open transition before moving focus into the input.
  window.setTimeout(() => els.input.focus(), 150);
}

export function closeChat() {
  if (!state.isOpen) return;
  state.isOpen = false;
  els.window.classList.remove("is-open");
  els.window.setAttribute("aria-hidden", "true");
  els.toggleBtn.classList.remove("is-open");
  els.toggleBtn.setAttribute("aria-expanded", "false");
  els.toggleBtn.setAttribute("aria-label", "Open menu assistant chat");
  els.toggleBtn.focus();
}

export function toggleChat() {
  if (state.isOpen) {
    closeChat();
  } else {
    openChat();
  }
}

/* --------------------------------------------------------------------------
   Init
   -------------------------------------------------------------------------- */

function bindEvents() {
  els.toggleBtn.addEventListener("click", toggleChat);
  if (els.closeBtn) els.closeBtn.addEventListener("click", closeChat);

  // Escape closes the chat window.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.isOpen) closeChat();
  });
}

export function initChat() {
  if (!cacheElements()) return;
  bindEvents();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChat);
} else {
  initChat();
}
