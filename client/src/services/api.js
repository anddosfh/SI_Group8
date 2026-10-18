const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export function getToken() { return localStorage.getItem("nova_token"); }
export function setSession(token, user) {
  localStorage.setItem("nova_token", token);
  localStorage.setItem("nova_user", JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem("nova_token");
  localStorage.removeItem("nova_user");
}
export function getSavedUser() {
  try { return JSON.parse(localStorage.getItem("nova_user") || "null"); }
  catch { return null; }
}
export async function api(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
