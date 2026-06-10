import asyncio
import re
import sys
import time
import uuid
from dataclasses import dataclass


@dataclass
class ProbeResult:
    success: bool
    duration_ms: float = 0.0
    detail: str = ""
    data: dict | None = None


async def probe_ping(ip: str, timeout_ms: int = 2000) -> ProbeResult:
    start = time.monotonic()
    try:
        if sys.platform == "win32":
            cmd = ["ping", "-n", "1", "-w", str(timeout_ms), ip]
        else:
            timeout_s = max(1, timeout_ms // 1000)
            cmd = ["ping", "-c", "1", "-W", str(timeout_s), ip]

        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=timeout_ms / 1000 + 2)
        elapsed = (time.monotonic() - start) * 1000

        if process.returncode == 0:
            ping_ms = elapsed
            match = re.search(r"time[=<](\d+\.?\d*)", stdout.decode("utf-8", errors="replace"))
            if match:
                ping_ms = float(match.group(1))
            return ProbeResult(success=True, duration_ms=ping_ms, detail="Ping OK", data={"ping_ms": ping_ms})
        return ProbeResult(success=False, duration_ms=elapsed, detail="No response")
    except (asyncio.TimeoutError, OSError) as e:
        elapsed = (time.monotonic() - start) * 1000
        return ProbeResult(success=False, duration_ms=elapsed, detail=str(e))


async def probe_smb_port(ip: str, timeout_s: int = 3) -> ProbeResult:
    start = time.monotonic()
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(ip, 445), timeout=timeout_s)
        elapsed = (time.monotonic() - start) * 1000
        writer.close()
        await writer.wait_closed()
        return ProbeResult(success=True, duration_ms=elapsed, detail="Port 445 open")
    except (asyncio.TimeoutError, OSError, ConnectionRefusedError) as e:
        elapsed = (time.monotonic() - start) * 1000
        return ProbeResult(success=False, duration_ms=elapsed, detail=str(e))


async def probe_smb_auth(ip: str, username: str, password: str, domain: str = "", timeout_s: int = 5) -> ProbeResult:
    start = time.monotonic()
    try:
        from smbprotocol.connection import Connection
        from smbprotocol.session import Session as SMBSession

        conn = Connection(uuid.uuid4(), ip, 445)
        await asyncio.get_event_loop().run_in_executor(None, conn.connect)

        session = SMBSession(conn, username, password, domain=domain if domain else None)
        await asyncio.get_event_loop().run_in_executor(None, session.connect)

        elapsed = (time.monotonic() - start) * 1000

        await asyncio.get_event_loop().run_in_executor(None, session.disconnect, True)
        await asyncio.get_event_loop().run_in_executor(None, conn.disconnect, True)

        return ProbeResult(success=True, duration_ms=elapsed, detail="SMB auth OK")
    except Exception as e:
        elapsed = (time.monotonic() - start) * 1000
        return ProbeResult(success=False, duration_ms=elapsed, detail=str(e))


async def probe_folder_access(
    ip: str, username: str, password: str, domain: str = "", timeout_s: int = 5
) -> ProbeResult:
    start = time.monotonic()
    try:
        from smbclient import listdir, register_session

        await asyncio.get_event_loop().run_in_executor(
            None, lambda: register_session(ip, username=username, password=password)
        )

        users_path = f"\\\\{ip}\\C$\\Users"
        entries = await asyncio.get_event_loop().run_in_executor(None, lambda: listdir(users_path))

        folders_found = []
        target_folders = {"Desktop", "Documents", "Downloads"}
        skip_users = {"Public", "Default", "Default User", "All Users"}

        for user_dir in entries:
            if user_dir in skip_users:
                continue
            for target in target_folders:
                try:
                    sub_path = f"{users_path}\\{user_dir}\\{target}"
                    await asyncio.get_event_loop().run_in_executor(None, lambda p=sub_path: listdir(p))
                    folders_found.append(f"{user_dir}/{target}")
                except OSError:
                    pass

        elapsed = (time.monotonic() - start) * 1000

        if folders_found:
            return ProbeResult(
                success=True, duration_ms=elapsed, detail=f"Found {len(folders_found)} folders",
                data={"folders_found": folders_found},
            )
        return ProbeResult(success=False, duration_ms=elapsed, detail="No accessible user folders found")
    except Exception as e:
        elapsed = (time.monotonic() - start) * 1000
        return ProbeResult(success=False, duration_ms=elapsed, detail=str(e))
