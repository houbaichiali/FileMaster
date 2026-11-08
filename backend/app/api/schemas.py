from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Level = Literal["low", "medium", "high", "maximum"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConvertRequest(Strict):
    file_id: str = Field(min_length=32, max_length=32)
    target: str = Field(min_length=2, max_length=5)


class CompressRequest(Strict):
    file_id: str = Field(min_length=32, max_length=32)
    level: Level = "medium"
    target_size_mb: float | None = Field(None, gt=0, le=10000)
    quality: int | None = Field(None, ge=1, le=100)
    max_width: int | None = Field(None, ge=16, le=20000)
    max_height: int | None = Field(None, ge=16, le=20000)
    output_format: str | None = Field(None, max_length=5)
    bitrate_kbps: int | None = Field(None, ge=8, le=512)
    resolution: int | None = Field(None, ge=144, le=4320)
    codec: Literal["h264", "h265", "vp9"] | None = None
    video_bitrate_kbps: int | None = Field(None, ge=30, le=100000)


class CropBox(Strict):
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: float = Field(gt=0, le=40000)
    height: float = Field(gt=0, le=40000)


class ResizeBox(Strict):
    width: int | None = Field(None, ge=1, le=20000)
    height: int | None = Field(None, ge=1, le=20000)


class ImageEditRequest(Strict):
    file_id: str = Field(min_length=32, max_length=32)
    crop: CropBox | None = None
    rotate: float = Field(0.0, ge=-360, le=360)
    flip_h: bool = False
    flip_v: bool = False
    resize: ResizeBox | None = None
    output_format: str | None = Field(None, max_length=5)
    quality: int = Field(92, ge=1, le=100)


class TrimRequest(Strict):
    file_id: str = Field(min_length=32, max_length=32)
    start: float = Field(ge=0, le=10**6)
    end: float = Field(gt=0, le=10**6)
    output_format: str | None = Field(None, max_length=5)
    precise: bool = True
