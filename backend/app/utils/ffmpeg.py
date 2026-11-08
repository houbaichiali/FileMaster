"""Safe FFmpeg / FFprobe execution: argument lists only, never a shell."""
import json
import logging
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Callable

from app.core.config import get_settings
from app.core.errors import AppError

log = logging.getLogger("filemaster.ffmpeg")


def probe(path: Path) -> dict:
    s = get_settings()
    cmd = [s.ffprobe_path, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=30, check=False)
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        raise AppError("probe_failed", 422)
    if proc.returncode != 0:
        raise AppError("invalid_media", 422)
    try:
        data = json.loads(proc.stdout or b"{}")
    except ValueError:
        raise AppError("invalid_media", 422)
    streams, fmt = data.get("streams", []), data.get("format", {})
    video = next((x for x in streams if x.get("codec_type") == "video" and not x.get("disposition", {}).get("attached_pic")), None)
    audio = next((x for x in streams if x.get("codec_type") == "audio"), None)
    if video is None and audio is None:
        raise AppError("invalid_media", 422)
    try:
        duration = float(fmt.get("duration") or (video or audio).get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0.0
    return {
        "duration": duration,
        "has_video": video is not None,
        "has_audio": audio is not None,
        "width": (video or {}).get("width"),
        "height": (video or {}).get("height"),
        "video_codec": (video or {}).get("codec_name"),
        "audio_codec": (audio or {}).get("codec_name"),
        "bitrate": int(fmt.get("bit_rate") or 0),
    }


def run_ffmpeg(args: list, duration: float = 0.0, on_progress: Callable[[float], None] | None = None) -> None:
    s = get_settings()
    cmd = [s.ffmpeg_path, "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-progress", "pipe:1", "-nostats",
           *[str(a) for a in args]]
    timed_out = threading.Event()
    with tempfile.TemporaryFile() as err:
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=err, text=True)
        except OSError:
            raise AppError("ffmpeg_missing", 500)

        def kill():
            timed_out.set()
            proc.kill()

        timer = threading.Timer(s.ffmpeg_timeout_s, kill)
        timer.start()
        try:
            for line in proc.stdout:  # type: ignore[union-attr]
                if line.startswith("out_time_us=") and duration > 0 and on_progress:
                    try:
                        on_progress(min(int(line.split("=")[1]) / 1e6 / duration, 0.99))
                    except ValueError:
                        pass
            proc.wait()
        finally:
            timer.cancel()
            if proc.poll() is None:
                proc.kill()
        if timed_out.is_set():
            raise AppError("timeout", 504)
        if proc.returncode != 0:
            err.seek(0)
            log.warning("ffmpeg failed: %s", err.read()[-1500:].decode("utf-8", "replace"))
            raise AppError("processing_failed", 422)
