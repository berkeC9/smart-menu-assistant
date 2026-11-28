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

import { sendChatMessage } from "./api.js";

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
   Typing indicator
   -------------------------------------------------------------------------- */

function showTyping() {
  hideTyping();
  const wrapper = document.createElement("div");
  wrapper.className = "chat-message chat-message-assistant";
  wrapper.id = "chat-typing-indicator";
  wrapper.setAttribute("aria-label", "Assistant is typing");
  wrapper.innerHTML = `
    <div class="chat-message-avatar" aria-hidden="true"><i class="bi bi-stars"></i></div>
    <div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>
  `;
  els.messages.appendChild(wrapper);
  scrollToBottom();
}

function hideTyping() {
  const indicator = document.getElementById("chat-typing-indicator");
  if (indicator) indicator.remove();
}

/* --------------------------------------------------------------------------
   Filter context (read from the filter panel in index.html)
   -------------------------------------------------------------------------- */

const ALLERGEN_LABELS = {
  peanut: "Peanut",
  tree_nut: "Tree Nut",
  dairy: "Dairy",
  gluten: "Gluten",
  egg: "Egg",
  soy: "Soy",
  seafood: "Seafood",
  sesame: "Sesame",
};

function formatAllergen(code) {
  return ALLERGEN_LABELS[code] || code.replace(/_/g, " ");
}

/**
 * Collect the allergen / diet / calorie filters currently selected in the UI
 * so the backend can pre-filter the menu before asking the LLM.
 */
function getFilterContext() {
  const checkedValues = (selector) =>
    Array.from(document.querySelectorAll(selector)).map((input) => input.value);

  const tracesToggle = document.getElementById("exclude-traces-toggle");
  const calorieRange = document.getElementById("calorie-range");

  let maxCalories = null;
  if (calorieRange) {
    const value = Number(calorieRange.value);
    // The slider's max value means "no limit".
    if (value && value < Number(calorieRange.max)) maxCalories = value;
  }

  return {
    excludeAllergens: checkedValues("#allergen-filter-group input[type='checkbox']:checked"),
    excludeTraces: tracesToggle ? tracesToggle.checked : true,
    diets: checkedValues("input[id^='diet-']:checked"),
    maxCalories,
  };
}

// Show which allergens the assistant is guarding against.
function updateGuardBar() {
  if (!els.guardBar) return;
  const { excludeAllergens, excludeTraces } = getFilterContext();

  if (excludeAllergens.length === 0) {
    els.guardBar.innerHTML = '<i class="bi bi-shield-check me-1"></i> No allergens selected yet.';
    return;
  }

  const names = excludeAllergens.map(formatAllergen).join(", ");
  const traces = excludeTraces ? " (incl. traces)" : "";
  els.guardBar.innerHTML = '<i class="bi bi-shield-check me-1"></i> Guarding against: ';
  const strong = document.createElement("strong");
  strong.textContent = `${names}${traces}`;
  els.guardBar.appendChild(strong);
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
  resetInput();

  state.isSending = true;
  updateSendButton();
  showTyping();

  try {
    const response = await sendChatMessage(message, {
      ...getFilterContext(),
      history: state.history,
    });

    hideTyping();
    const reply = (response && response.reply) || "Sorry, I couldn't come up with an answer.";
    appendMessage("assistant", reply);

    // Only store successful turns so failed requests can simply be retried.
    state.history.push({ role: "user", content: message });
    state.history.push({ role: "assistant", content: reply.slice(0, 4000) });

    if (!state.isOpen) setUnread(true);
  } catch (error) {
    hideTyping();
    const text = (error && error.message) || "Something went wrong. Please try again.";
    appendMessage("assistant", text, { isError: true });
  } finally {
    state.isSending = false;
    updateSendButton();
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

  // Keep the guard bar in sync with the filter panel.
  const filters = document.getElementById("filters-container");
  if (filters) filters.addEventListener("change", updateGuardBar);
}

export function initChat() {
  if (!cacheElements()) return;
  bindEvents();
  updateGuardBar();
  appendMessage("assistant", WELCOME_MESSAGE);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChat);
} else {
  initChat();
}
