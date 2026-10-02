import { getToken } from "../auth";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "");

/** Append Appwrite-style query objects as a JSON `queries` search param. */
export function withQueries(path, queries = []) {
  if (!queries || queries.length === 0) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}queries=${encodeURIComponent(JSON.stringify(queries))}`;
}

export async function request(path, { method = "GET", body, isForm = false, auth = true } = {}) {
  const headers = {};
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body !== undefined) {
    if (isForm) {
      options.body = body;
    } else {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
  }

  const response = await fetch(`${API_URL}${path}`, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = data?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
  upload: (path, formData) => request(path, { method: "POST", body: formData, isForm: true }),
};

export { API_URL };
