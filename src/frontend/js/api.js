/**
 * api.js
 * ---------------------------------------------------------------------------
 * Small fetch-based client used by the frontend modules (menu, filters, chat)
 * to talk to the FastAPI backend.
 */

// Same-origin by default (FastAPI serves the frontend). Can be overridden by
// setting window.SMA_API_BASE_URL before this module is loaded.
const API_BASE_URL = (window.SMA_API_BASE_URL || "").replace(/\/+$/, "");

/**
 * Error thrown when the backend returns a non-2xx response or cannot be reached.
 */
export class ApiError extends Error {
  /**
   * @param {string} message - Human readable error message.
   * @param {number} status - HTTP status code (0 when the network failed).
   * @param {*} [details] - Parsed response body, if any.
   */
  constructor(message, status, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Core request helper. Sends a JSON request and returns the parsed body.
 *
 * @param {string} path - Endpoint path starting with "/api/...".
 * @param {RequestInit} [options] - Extra fetch options.
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkError) {
    throw new ApiError("Unable to reach the server. Please try again.", 0, networkError);
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text();

  if (!response.ok) {
    // FastAPI puts error messages inside a "detail" field.
    const message =
      (data && typeof data === "object" && typeof data.detail === "string" && data.detail) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

/**
 * Build a query string from a filters object. Empty values are skipped and
 * arrays are joined with commas (e.g. exclude_allergens=peanut,dairy).
 *
 * @param {Record<string, any>} params
 * @returns {string} Query string including the leading "?" or an empty string.
 */
function buildQueryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      search.append(key, value.join(","));
    } else {
      search.append(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * Fetch menu items from GET /api/menu with optional filters.
 *
 * @param {Object} [filters]
 * @param {string} [filters.search] - Free text search on name / ingredients.
 * @param {string} [filters.category] - Category slug.
 * @param {string[]} [filters.excludeAllergens] - Allergen codes to exclude.
 * @param {boolean} [filters.excludeTraces] - Also exclude "may contain traces".
 * @param {string[]} [filters.diets] - vegan, vegetarian, gluten_free.
 * @param {number} [filters.maxCalories] - Calorie upper limit.
 * @param {number} [filters.maxSpiceLevel] - Spice level upper limit.
 * @param {string} [filters.sort] - Sort key (e.g. "price_asc").
 * @returns {Promise<any>}
 */
export function getMenu(filters = {}) {
  const query = buildQueryString({
    search: filters.search,
    category: filters.category,
    exclude_allergens: filters.excludeAllergens,
    exclude_traces: filters.excludeTraces,
    diets: filters.diets,
    max_calories: filters.maxCalories,
    max_spice_level: filters.maxSpiceLevel,
    sort: filters.sort,
  });
  return request(`/api/menu${query}`);
}

/**
 * Fetch a single dish from GET /api/menu/{id}.
 *
 * @param {number|string} dishId
 * @returns {Promise<any>}
 */
export function getDishById(dishId) {
  return request(`/api/menu/${encodeURIComponent(dishId)}`);
}

/**
 * Fetch all menu categories from GET /api/categories.
 *
 * @returns {Promise<any>}
 */
export function getCategories() {
  return request("/api/categories");
}

/**
 * Fetch supported allergen definitions from GET /api/allergens.
 * Response shape: { count: number, items: [{ code, name, description, keywords }] }
 *
 * @returns {Promise<{count: number, items: Array<Object>}>}
 */
export function getAllergens() {
  return request("/api/allergens");
}

/**
 * Fetch a single allergen definition from GET /api/allergens/{code}.
 *
 * @param {string} allergenCode - e.g. "peanut", "tree_nut".
 * @returns {Promise<Object>}
 */
export function getAllergenDetail(allergenCode) {
  return request(`/api/allergens/${encodeURIComponent(allergenCode)}`);
}
