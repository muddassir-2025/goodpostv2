import { WebSocketServer } from "ws";
import { verifyToken } from "./auth.js";

/** userId -> Set<WebSocket> */
const channels = new Map();

function addSocket(userId, socket) {
  if (!channels.has(userId)) channels.set(userId, new Set());
  channels.get(userId).add(socket);
}

function removeSocket(userId, socket) {
  const set = channels.get(userId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) channels.delete(userId);
}

/** Send an event to every open socket belonging to a user. */
export function emitToUser(userId, type, payload) {
  const set = channels.get(String(userId));
  if (!set) return;
  const message = JSON.stringify({ type, payload });
  for (const socket of set) {
    if (socket.readyState === socket.OPEN) socket.send(message);
  }
}

export function emitToUsers(userIds, type, payload) {
  for (const id of new Set((userIds || []).map(String))) {
    emitToUser(id, type, payload);
  }
}

export function setupRealtime(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (socket, request) => {
    let userId = null;
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get("token");
      const payload = await verifyToken(token);
      userId = payload?.sub || payload?.id || null;
    } catch {
      userId = null;
    }

    if (!userId) {
      socket.close(4401, "Unauthorized");
      return;
    }

    addSocket(userId, socket);
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    socket.on("message", (data) => {
      // Clients may opt into a lightweight "ping" to keep the connection warm.
      if (data.toString() === "ping") socket.send("pong");
    });
    socket.on("close", () => removeSocket(userId, socket));
    socket.on("error", () => removeSocket(userId, socket));

    socket.send(JSON.stringify({ type: "connected", payload: { userId } }));
  });

  // Drop dead connections so the channel map does not grow unbounded.
  const interval = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      try {
        socket.ping();
      } catch {
        socket.terminate();
      }
    }
  }, 30000);

  wss.on("close", () => clearInterval(interval));
  return wss;
}
