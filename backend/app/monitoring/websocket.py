import logging

from fastapi import WebSocket

from app.monitoring.schemas import PCHealthSnapshot

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._connections: list[WebSocket] = []
        self._last_snapshot: dict[str, PCHealthSnapshot] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.append(websocket)
        if self._last_snapshot:
            await websocket.send_json(
                {"type": "snapshot", "data": [s.model_dump(mode="json") for s in self._last_snapshot.values()]}
            )

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self._connections:
            self._connections.remove(websocket)

    async def broadcast_change(self, snapshot: PCHealthSnapshot) -> None:
        previous = self._last_snapshot.get(snapshot.pc_id)
        self._last_snapshot[snapshot.pc_id] = snapshot

        if previous and previous.status == snapshot.status:
            return

        message = {"type": "status_change", "data": snapshot.model_dump(mode="json")}
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_full_snapshot(self) -> None:
        if not self._last_snapshot:
            return
        message = {"type": "snapshot", "data": [s.model_dump(mode="json") for s in self._last_snapshot.values()]}
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


health_manager = ConnectionManager()
