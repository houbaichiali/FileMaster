"""Video conversion, compression and trimming (FFmpeg)."""
from pathlib import Path

from app.core.errors import AppError
from app.utils.ffmpeg import probe, run_ffmpeg

# level -> (h264 CRF, VP9 CRF, max output height or None)
LEVELS = {"low": (21, 30, None), "medium": (26, 34, 1080), "high": (30, 38, 720), "maximum": (35, 44, 480)}
CODEC_FOR_FORMAT = {"mp4": "h264", "mov": "h264", "mkv": "h264", "webm": "vp9"}


def _video_args(fmt: str, codec: str, crf: tuple[int, int] | None, video_bitrate_k: int | None, height: int | None,
                audio_k: int = 128) -> list:
    if fmt == "webm" and codec != "vp9":
        raise AppError("codec_incompatible", 422)
    if fmt != "webm" and codec == "vp9":
        raise AppError("codec_incompatible", 422)
    args: list = []
    if height:
        args += ["-vf", f"scale=-2:'min({int(height)},ih)'"]
    if codec == "h264":
        args += ["-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p"]
        args += ["-b:v", f"{video_bitrate_k}k", "-maxrate", f"{int(video_bitrate_k * 1.5)}k", "-bufsize", f"{video_bitrate_k * 2}k"] \
            if video_bitrate_k else ["-crf", crf[0]]
    elif codec == "h265":
        args += ["-c:v", "libx265", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-x265-params", "log-level=error"]
        if fmt in ("mp4", "mov"):
            args += ["-tag:v", "hvc1"]
        args += ["-b:v", f"{video_bitrate_k}k"] if video_bitrate_k else ["-crf", crf[0] + 2]
    else:  # vp9
        args += ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-pix_fmt", "yuv420p"]
        args += ["-b:v", f"{video_bitrate_k}k"] if video_bitrate_k else ["-crf", crf[1], "-b:v", "0"]
    if fmt == "webm":
        args += ["-c:a", "libopus", "-b:a", f"{audio_k}k"]
    else:
        args += ["-c:a", "aac", "-b:a", f"{audio_k}k"]
    if fmt in ("mp4", "mov"):
        args += ["-movflags", "+faststart"]
    return args


def _need_video(info: dict) -> None:
    if not info["has_video"]:
        raise AppError("no_video_stream", 422)


def convert(src: Path, out: Path, target: str, on_progress=None) -> dict:
    info = probe(src)
    _need_video(info)
    codec = CODEC_FOR_FORMAT[target]
    args = ["-i", src, "-map", "0:v:0", "-map", "0:a:0?", *_video_args(target, codec, (22, 31), None, None), out]
    run_ffmpeg(args, info["duration"], on_progress)
    return {"codec": codec}


def compress(src: Path, out: Path, in_fmt: str, level: str, out_fmt: str | None = None, codec: str | None = None,
             resolution: int | None = None, video_bitrate_k: int | None = None, target_bytes: int | None = None,
             on_progress=None) -> dict:
    out_fmt = out_fmt or in_fmt
    codec = codec or CODEC_FOR_FORMAT[out_fmt]
    info = probe(src)
    _need_video(info)
    crf_h264, crf_vp9, max_h = LEVELS[level]
    height = resolution or max_h
    audio_k = {"low": 160, "medium": 128, "high": 96, "maximum": 64}[level]
    reached = None
    if target_bytes:
        if info["duration"] <= 0:
            raise AppError("invalid_media", 422)
        total_k = target_bytes * 8 * 0.94 / info["duration"] / 1000
        audio_k = 64 if total_k < 600 else 96
        video_bitrate_k = int(max(30, total_k - audio_k))
        reached = total_k - audio_k >= 30
        if height is None and video_bitrate_k < 1500:
            height = 720 if video_bitrate_k >= 600 else 480
    args = ["-i", src, "-map", "0:v:0", "-map", "0:a:0?",
            *_video_args(out_fmt, codec, (crf_h264, crf_vp9), video_bitrate_k, height, audio_k), out]
    run_ffmpeg(args, info["duration"], on_progress)
    details = {"codec": codec, "crf": None if video_bitrate_k else (crf_vp9 if codec == "vp9" else crf_h264),
               "height": height, "video_bitrate_kbps": video_bitrate_k, "output_format": out_fmt}
    if reached is not None:
        details["target_reached"] = reached and out.stat().st_size <= target_bytes * 1.05
    return details


def trim(src: Path, out: Path, in_fmt: str, out_fmt: str, start: float, end: float, precise: bool = True,
         on_progress=None) -> dict:
    info = probe(src)
    _need_video(info)
    if not (0 <= start < end) or end > info["duration"] + 0.05:
        raise AppError("invalid_range", 422)
    length = end - start
    if not precise and out_fmt == in_fmt:
        run_ffmpeg(["-ss", f"{start:.3f}", "-i", src, "-t", f"{length:.3f}", "-map", "0:v:0", "-map", "0:a:0?",
                    "-c", "copy", "-avoid_negative_ts", "make_zero", out], length, on_progress)
        return {"mode": "copy", "duration": length}
    codec = CODEC_FOR_FORMAT[out_fmt]
    args = ["-ss", f"{start:.3f}", "-i", src, "-t", f"{length:.3f}", "-map", "0:v:0", "-map", "0:a:0?",
            *_video_args(out_fmt, codec, (20, 30), None, None), out]
    run_ffmpeg(args, length, on_progress)
    return {"mode": "precise", "duration": length}
