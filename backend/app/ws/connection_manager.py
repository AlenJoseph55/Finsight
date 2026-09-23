"""
FinSight WebSocket Connection Manager.

A lightweight asyncio-native hub that manages persistent browser connections
for real-time alert delivery. Consumes negligible resources (~15-25KB RAM
per client) by using Python's native async I/O without any message brokers.

Architecture:
  - active_connections: Dict[user_id -> List[WebSocket]]
    Supports multiple browser tabs per user (e.g. desktop + mobile).
  - broadcast_to_user: Pushes a JSON payload to every tab for that user.
  - Gracefully handles dead sockets (stale connections are pruned on send).
"""

import asyncio
from typing import Dict, List

from fastapi import WebSocket

from backend.app.core.logging import logger


class ConnectionManager:
    def __init__(self):
        # Maps user_id -> list of active WebSocket connections (multiple tabs)
        self.active_connections: Dict[int, List[WebSocket]] = {}

    def connect(self, user_id: int, websocket: WebSocket) -> None:
        """Register a new WebSocket for a user."""
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(
            f"WS connected: user_id={user_id}, "
            f"total_tabs={len(self.active_connections[user_id])}, "
            f"total_users={len(self.active_connections)}"
        )

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        """Remove a WebSocket when the browser tab closes."""
        if user_id in self.active_connections:
            try:
                self.active_connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(
            f"WS disconnected: user_id={user_id}, "
            f"remaining_users={len(self.active_connections)}"
        )

    async def broadcast_to_user(self, user_id: int, payload: dict) -> int:
        """
        Push a JSON message to every active tab for a given user.
        Returns the number of tabs successfully reached.
        Prunes stale/dead connections automatically.
        """
        if user_id not in self.active_connections:
            return 0

        connections = list(self.active_connections[user_id])
        dead: List[WebSocket] = []
        sent = 0

        for ws in connections:
            try:
                await ws.send_json(payload)
                sent += 1
            except Exception as exc:
                logger.warning(
                    f"WS send failed for user_id={user_id}: {exc} — pruning connection"
                )
                dead.append(ws)

        # Prune dead connections
        for ws in dead:
            self.disconnect(user_id, ws)

        return sent

    async def broadcast_to_all(self, payload: dict) -> int:
        """Broadcast to all connected users (e.g. system-wide announcement)."""
        tasks = [
            self.broadcast_to_user(uid, payload)
            for uid in list(self.active_connections.keys())
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return sum(r for r in results if isinstance(r, int))

    @property
    def connected_user_count(self) -> int:
        return len(self.active_connections)

    @property
    def connected_tab_count(self) -> int:
        return sum(len(tabs) for tabs in self.active_connections.values())


# ── Global singleton shared across all routers and agents ──────────────────
ws_manager = ConnectionManager()
