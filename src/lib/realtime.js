import { getToken } from "../auth";
import { API_URL } from "../api/client";

const listeners = new Map(); // eventType -> Set<handler>
let socket = null;
let connecting = null;
let reconnectTimer = null;

function wsUrl(token) {
  const url = new URL(API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = `?token=${encodeURIComponent(token)}`;
  return url.toString();
}

function emit(type, payload) {
  for (const handler of listeners.get(type) || []) handler(payload);
  for (const handler of listeners.get("*") || []) handler(payload, type);
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (listeners.size > 0) connect().catch(scheduleReconnect);
  }, 3000);
}

function connect() {
  if (socket?.readyState === WebSocket.OPEN) return Promise.resolve(socket);
  if (connecting) return connecting;

  connecting = (async () => {
    const token = await getToken();
    if (!token) throw new Error("No auth token available for realtime connection");

    const ws = new WebSocket(wsUrl(token));
    await new Promise((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Realtime connection failed"));
    });

    socket = ws;
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type) emit(data.type, data.payload);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (socket === ws) socket = null;
      scheduleReconnect();
    };
    return ws;
  })().finally(() => {
    connecting = null;
  });

  return connecting;
}

function ensureConnected() {
  connect().catch(scheduleReconnect);
}

/**
 * Subscribe to a realtime event type. Returns an unsubscribe function,
 * matching the shape of the previous Appwrite `client.subscribe(...)` calls.
 */
export function subscribe(type, handler) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(handler);
  ensureConnected();
  return () => {
    listeners.get(type)?.delete(handler);
  };
}

export function disconnectRealtime() {
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}
