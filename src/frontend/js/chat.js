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

// Example questions shown as quick reply chips above the input.
const QUICK_QUESTIONS = [
  "I have a peanut allergy, what can I eat?",
  "Which dishes are vegan?",
  "Suggest a gluten-free main course",
  "Something light under 500 calories?",
  "What's dairy-free for dessert?",
  "Which dishes are not spicy?",
];

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
   Recommended dish cards
   -------------------------------------------------------------------------- */

const DIET_LABELS = [
  ["is_vegan", "vegan", "Vegan"],
  ["is_vegetarian", "vegetarian", "Vegetarian"],
  ["is_gluten_free", "gluten_free", "Gluten-Free"],
];

function formatPrice(price) {
  const value = Number(price);
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : "";
}

function createBadge(className, text) {
  const badge = document.createElement("span");
  badge.className = className;
  badge.textContent = text;
  return badge;
}

/**
 * Build a small clickable card for a dish recommended by the assistant.
 *
 * @param {Object} dish - DishResponse from the backend.
 * @param {string[]} excludedAllergens - Allergens the user asked to avoid.
 * @returns {HTMLElement}
 */
function createDishCard(dish, excludedAllergens) {
  const card = document.createElement("article");
  card.className = "chat-dish-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `View details for ${dish.name}`);
  card.dataset.dishId = dish.id;

  if (dish.image_url) {
    const img = document.createElement("img");
    img.className = "chat-dish-card-image";
    img.src = dish.image_url;
    img.alt = dish.name;
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    card.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "chat-dish-card-body";

  const title = document.createElement("h3");
  title.className = "chat-dish-card-title";
  title.textContent = dish.name;
  title.title = dish.name;
  body.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "chat-dish-card-meta";
  const calories = dish.nutrition_facts && dish.nutrition_facts.calories;
  const info = document.createElement("span");
  info.textContent = calories != null ? `${calories} kcal` : dish.category || "";
  const price = document.createElement("span");
  price.className = "chat-dish-card-price";
  price.textContent = formatPrice(dish.price);
  meta.append(info, price);
  body.appendChild(meta);

  const badges = document.createElement("div");
  badges.className = "chat-dish-card-badges";
  DIET_LABELS.forEach(([field, code, label]) => {
    if (dish[field]) badges.appendChild(createBadge(`badge-diet badge-diet-${code}`, label));
  });
  (dish.allergens || []).forEach((code) => {
    badges.appendChild(createBadge(`badge-allergen badge-allergen-${code}`, formatAllergen(code)));
  });
  if (badges.childElementCount > 0) body.appendChild(badges);
  card.appendChild(body);

  // Safety strip: confirm the dish is free of the user's allergens,
  // or warn about possible cross-contamination.
  const traces = dish.may_contain_traces || [];
  const safe = document.createElement("div");
  safe.className = "chat-dish-card-safe";
  if (traces.length > 0) {
    safe.classList.add("has-traces");
    safe.textContent = `May contain traces: ${traces.map(formatAllergen).join(", ")}`;
  } else if (excludedAllergens.length > 0) {
    safe.textContent = "\u2713 Safe for your allergens";
  } else {
    safe.textContent = "\u2713 No trace warnings";
  }
  card.appendChild(safe);

  const openDetails = () => {
    // menu.js listens for this event and opens the dish detail modal.
    document.dispatchEvent(new CustomEvent("sma:show-dish", { detail: { dishId: dish.id, dish } }));
  };
  card.addEventListener("click", openDetails);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetails();
    }
  });

  return card;
}

/**
 * Render recommended dishes as a horizontal list of cards under a bubble.
 *
 * @param {HTMLElement} container - Element returned by appendMessage().
 * @param {Array<Object>} dishes
 * @param {string[]} excludedAllergens
 */
function renderRecommendations(container, dishes, excludedAllergens) {
  if (!Array.isArray(dishes) || dishes.length === 0) return;

  const list = document.createElement("div");
  list.className = "chat-recommendations";
  list.setAttribute("aria-label", "Recommended dishes");
  dishes.forEach((dish) => list.appendChild(createDishCard(dish, excludedAllergens)));

  // Place cards between the bubble and the timestamp.
  const time = container.querySelector(".chat-message-time");
  container.insertBefore(list, time);
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
  resetInput();

  state.isSending = true;
  updateSendButton();
  setSuggestionsDisabled(true);
  showTyping();

  try {
    const context = getFilterContext();
    const response = await sendChatMessage(message, {
      ...context,
      history: state.history,
    });

    hideTyping();
    const reply = (response && response.reply) || "Sorry, I couldn't come up with an answer.";
    const container = appendMessage("assistant", reply);
    renderRecommendations(container, response && response.recommended_dishes, context.excludeAllergens);

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
    setSuggestionsDisabled(false);
  }
}

/* --------------------------------------------------------------------------
   Quick questions & clearing the conversation
   -------------------------------------------------------------------------- */

function renderSuggestions() {
  if (!els.suggestions) return;
  els.suggestions.innerHTML = "";
  QUICK_QUESTIONS.forEach((question) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chat-suggestion-chip";
    chip.textContent = question;
    chip.addEventListener("click", () => sendMessage(question));
    els.suggestions.appendChild(chip);
  });
}

function setSuggestionsDisabled(disabled) {
  if (!els.suggestions) return;
  els.suggestions.querySelectorAll("button").forEach((chip) => {
    chip.disabled = disabled;
  });
}

export function clearConversation() {
  if (state.isSending) return;
  state.history = [];
  els.messages.innerHTML = "";
  appendSystemNote("Conversation cleared");
  appendMessage("assistant", WELCOME_MESSAGE);
  resetInput();
  els.input.focus();
}

/* --------------------------------------------------------------------------
   Init
   -------------------------------------------------------------------------- */

function bindEvents() {
  els.toggleBtn.addEventListener("click", toggleChat);
  if (els.closeBtn) els.closeBtn.addEventListener("click", closeChat);
  if (els.clearBtn) els.clearBtn.addEventListener("click", clearConversation);

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
  renderSuggestions();
  appendMessage("assistant", WELCOME_MESSAGE);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChat);
} else {
  initChat();
}
