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
  // Conversation history sent to the backend so the assistant keeps context.
  history: [],
};

const MAX_INPUT_LENGTH = 1000;
const WELCOME_MESSAGE =
  "Hi! I'm your menu assistant. Tell me about your allergies or diet and I'll suggest dishes that are safe for you.";

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
   Message rendering
   -------------------------------------------------------------------------- */

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

/**
 * Append a chat bubble to the message list.
 * Text is always inserted with textContent to avoid HTML injection.
 *
 * @param {"user"|"assistant"} role
 * @param {string} text
 * @param {Object} [options]
 * @param {boolean} [options.isError] - Render the bubble in the error style.
 * @returns {HTMLElement} The bubble element (used to attach dish cards).
 */
function appendMessage(role, text, { isError = false } = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = `chat-message chat-message-${role}`;
  if (isError) wrapper.classList.add("chat-message-error");

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "chat-message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML = '<i class="bi bi-stars"></i>';
    wrapper.appendChild(avatar);
  }

  const content = document.createElement("div");
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = text;

  const time = document.createElement("span");
  time.className = "chat-message-time";
  time.textContent = formatTime();

  content.appendChild(bubble);
  content.appendChild(time);
  wrapper.appendChild(content);
  els.messages.appendChild(wrapper);
  scrollToBottom();

  return content;
}

function appendSystemNote(text) {
  const note = document.createElement("div");
  note.className = "chat-system-note";
  note.textContent = text;
  els.messages.appendChild(note);
  scrollToBottom();
}

/* --------------------------------------------------------------------------
   Input handling
   -------------------------------------------------------------------------- */

// Grow the textarea with its content (capped by max-height in chat.css).
function autoResizeInput() {
  els.input.style.height = "auto";
  els.input.style.height = `${els.input.scrollHeight}px`;
}

function updateSendButton() {
  const hasText = els.input.value.trim().length > 0;
  els.sendBtn.disabled = !hasText || state.isSending;
}

function resetInput() {
  els.input.value = "";
  autoResizeInput();
  updateSendButton();
}

/**
 * Send a user message. Exported so other modules (e.g. dish cards) can
 * pre-fill questions for the assistant.
 *
 * @param {string} text
 */
export async function sendMessage(text) {
  const message = (text || "").trim().slice(0, MAX_INPUT_LENGTH);
  if (!message || state.isSending) return;

  appendMessage("user", message);
  state.history.push({ role: "user", content: message });
  resetInput();
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

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(els.input.value);
  });

  els.input.addEventListener("input", () => {
    autoResizeInput();
    updateSendButton();
  });

  // Enter sends, Shift+Enter inserts a new line.
  els.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendMessage(els.input.value);
    }
  });
}

export function initChat() {
  if (!cacheElements()) return;
  bindEvents();
  appendMessage("assistant", WELCOME_MESSAGE);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChat);
} else {
  initChat();
}
