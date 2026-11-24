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
