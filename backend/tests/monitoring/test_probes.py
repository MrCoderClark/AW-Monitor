import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.monitoring.probes import probe_ping, probe_smb_port, ProbeResult


@pytest.mark.asyncio
async def test_probe_ping_success():
    mock_process = AsyncMock()
    mock_process.returncode = 0
    mock_process.communicate = AsyncMock(return_value=(b"time=5ms", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        result = await probe_ping("192.168.1.1", timeout_ms=2000)
        assert result.success is True


@pytest.mark.asyncio
async def test_probe_ping_failure():
    mock_process = AsyncMock()
    mock_process.returncode = 1
    mock_process.communicate = AsyncMock(return_value=(b"Request timed out", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        result = await probe_ping("192.168.1.1", timeout_ms=2000)
        assert result.success is False


@pytest.mark.asyncio
async def test_probe_smb_port_success():
    mock_writer = AsyncMock()
    mock_writer.close = AsyncMock()
    mock_writer.wait_closed = AsyncMock()

    with patch("asyncio.open_connection", return_value=(AsyncMock(), mock_writer)):
        result = await probe_smb_port("192.168.1.1", timeout_s=3)
        assert result.success is True


@pytest.mark.asyncio
async def test_probe_smb_port_timeout():
    with patch("asyncio.open_connection", side_effect=asyncio.TimeoutError()):
        result = await probe_smb_port("192.168.1.1", timeout_s=3)
        assert result.success is False
