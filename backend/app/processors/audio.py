"""Audio conversion, compression and trimming (FFmpeg)."""
from pathlib import Path

from app.core.errors import AppError
from app.core.formats import LOSSLESS_AUDIO, LOSSY_AUDIO
from app.utils.ffmpeg import probe, run_ffmpeg

ENCODERS = {
    "mp3": ["-c:a", "libmp3lame"],
    "wav": ["-c:a", "pcm_s16le"],
    "aac": ["-c:a", "aac"],
    "flac": ["-c:a", "flac", "-compression_level", "12"],
    "ogg": ["-c:a", "libvorbis"],
    "m4a": ["-c:a", "aac", "-movflags", "+faststart"],
}
BITRATE = {"low": 192, "medium": 128, "high": 96, "maximum": 64}
# lossless outputs shrink by resampling: level -> (max sample rate, channels)
RESAMPLE = {"low": (None, None), "medium": (44100, None), "high": (32000, None), "maximum": (22050, 1)}


def _args(src: Path, out: Path, target: str, bitrate_k: int | None = None, rate: int | None = None,
          channels: int | None = None, pre: list | None = None, post: list | None = None) -> list:
    args = [*(pre or []), "-i", src, "-map", "0:a:0", "-vn", *ENCODERS[target]]
    if bitrate_k and target in LOSSY_AUDIO:
        args += ["-b:a", f"{bitrate_k}k"]
    if rate:
        args += ["-ar", rate]
    if channels:
        args += ["-ac", channels]
    return [*args, *(post or []), out]


def convert(src: Path, out: Path, target: str, on_progress=None) -> dict:
    info = probe(src)
    if not info["has_audio"]:
        raise AppError("no_audio_stream", 422)
    bitrate = 192 if target in LOSSY_AUDIO else None
    run_ffmpeg(_args(src, out, target, bitrate), info["duration"], on_progress)
    return {"bitrate_kbps": bitrate}


def compress(src: Path, out: Path, in_fmt: str, level: str, out_fmt: str | None = None,
             bitrate_k: int | None = None, target_bytes: int | None = None, on_progress=None) -> dict:
    out_fmt = out_fmt or in_fmt
    info = probe(src)
    if not info["has_audio"]:
        raise AppError("no_audio_stream", 422)
    duration = info["duration"]
    if out_fmt in LOSSY_AUDIO:
        if target_bytes:
            if duration <= 0:
                raise AppError("invalid_media", 422)
            bitrate_k = int(max(8, min(320, target_bytes * 8 * 0.95 / duration / 1000)))
        bitrate_k = bitrate_k or BITRATE[level]
        run_ffmpeg(_args(src, out, out_fmt, bitrate_k), duration, on_progress)
        return {"bitrate_kbps": bitrate_k, "output_format": out_fmt}
    if target_bytes:
        raise AppError("target_size_needs_lossy", 422)
    rate, channels = RESAMPLE[level]
    run_ffmpeg(_args(src, out, out_fmt, rate=rate, channels=channels), duration, on_progress)
    return {"sample_rate": rate, "channels": channels, "output_format": out_fmt}


def trim(src: Path, out: Path, in_fmt: str, out_fmt: str, start: float, end: float, precise: bool = True,
         on_progress=None) -> dict:
    info = probe(src)
    if not info["has_audio"]:
        raise AppError("no_audio_stream", 422)
    if not (0 <= start < end) or end > info["duration"] + 0.05:
        raise AppError("invalid_range", 422)
    length = end - start
    pre = ["-ss", f"{start:.3f}"]
    post = ["-t", f"{length:.3f}"]
    if not precise and out_fmt == in_fmt:
        run_ffmpeg([*pre, "-i", src, "-t", f"{length:.3f}", "-map", "0:a:0", "-vn", "-c", "copy", out], length, on_progress)
        return {"mode": "copy", "duration": length}
    bitrate = 192 if out_fmt in LOSSY_AUDIO else None
    run_ffmpeg(_args(src, out, out_fmt, bitrate, pre=pre, post=post), length, on_progress)
    return {"mode": "precise", "duration": length}
