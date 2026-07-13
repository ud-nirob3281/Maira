"""
Screenshot & screen-reading: capture, save, OCR, and read on-screen text.

  takeScreenshot    -> capture full screen, return metadata (+ small base64)
  saveScreenshot    -> capture & write to a file under the Screenshots folder
  analyzeScreenshot-> capture, run OCR (pytesseract), return extracted text
  readScreen        -> OCR the active window region + name the active window

This module owns the **unified screen capture** used across all tool modules:
  capture_screen(region=None, monitor=0)
returns a PIL Image of the full virtual desktop (all monitors) or a specific
region/monitor.  A short-lived LRU cache deduplicates repeated captures within
the same tool invocation (e.g. multiple OCR passes on the same frame).

OCR requires the Tesseract OCR engine + the pytesseract wrapper. If either is
missing, the OCR tools return a graceful 'unavailable' message instead of
crashing; non-OCR capture still works.
"""

from __future__ import annotations

import base64
import ctypes
import io
import os
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from .registry import ToolError, register

SCREENSHOTS_DIR = Path(os.path.expanduser("~")) / "Pictures" / "MyraaScreenshots"


# ── DPI / Scaling helpers ──────────────────────────────────────────────────────

# Module-level DPI cache — read once per process, returned on every call.
_DPI_SCALE: Optional[Tuple[float, float]] = None


def get_dpi_scaling() -> Tuple[float, float]:
    """Return (scale_x, scale_y) for the primary monitor.

    On a 1920×1080 display at 150 % scaling the physical resolution reported
    by ImageGrab is 2880×1620, so the scaling factor is 1.5.  This helper lets
    any tool convert between "logical" and "physical" pixel coordinates without
    duplicating Win32 calls.
    """
    global _DPI_SCALE
    if _DPI_SCALE is not None:
        return _DPI_SCALE

    try:
        # Try Per-Monitor V2 (Windows 10 1703+)
        _user32 = ctypes.windll.user32
        hwnd = _user32.GetDesktopWindow()
        dpi_x = ctypes.windll.user32.GetDpiForWindow(hwnd)
        scale = dpi_x / 96.0
        _DPI_SCALE = (scale, scale)
        return _DPI_SCALE
    except Exception:  # noqa: BLE001
        pass

    try:
        # Fallback: system-wide DPI via GDI
        hdc = ctypes.windll.user32.GetDC(0)
        dpi_x = ctypes.windll.gdi32.GetDeviceCaps(hdc, 88)  # LOGPIXELSX
        dpi_y = ctypes.windll.gdi32.GetDeviceCaps(hdc, 90)  # LOGPIXELSY
        ctypes.windll.user32.ReleaseDC(0, hdc)
        _DPI_SCALE = (dpi_x / 96.0, dpi_y / 96.0)
        return _DPI_SCALE
    except Exception:  # noqa: BLE001
        pass

    _DPI_SCALE = (1.0, 1.0)
    return _DPI_SCALE


# ── Unified screen capture ──────────────────────────────────────────────────────

# A monotonic counter incremented after every scroll / user action so that the
# LRU cache can distinguish frames taken at different wall-clock moments even
# when the bounding-box arguments are identical.
_capture_epoch: int = 0


def _invalidate_capture_cache() -> None:
    """Bump the epoch so the next capture_screen() call misses the cache.

    Called after any action that changes the screen contents (scroll, click,
    key press, sleep).  Callers that perform a loop of capture→OCR→scroll
    should call this before scrolling so the next iteration gets a fresh frame.
    """
    global _capture_epoch
    _capture_epoch += 1


def capture_screen(
    region: Optional[Tuple[int, int, int, int]] = None,
    monitor: int = 0,
) -> "Any":
    """Capture the screen and return a PIL Image (RGB).

    Parameters
    ----------
    region :
        (left, top, right, bottom) bounding box in **physical** pixels.
        If ``None`` the full virtual desktop is captured (all monitors).
    monitor :
        Index into the monitor list (0 = all, 1 = primary, 2+ = extras).
        **Ignored when *region* is given** — region always takes priority.

    The function is LRU-cached on ``(region, monitor, epoch)`` so that
    multiple OCR / visual passes within the same tool invocation reuse the
    same frame without hitting the Win32 capture API repeatedly.

    Multi-monitor:
        PIL ``ImageGrab.grab(all_screens=True)`` captures the entire virtual
        desktop (works across all monitors on Windows).  When *region* is given
        it is applied *after* the full-screen grab so coordinates are always
        in virtual-desktop space.

    DPI:
        No scaling is applied here — the returned image is in physical pixels
        as seen by the OS.  Use ``get_dpi_scaling()`` to convert when mapping
        OCR coordinates back to logical coordinates.
    """
    return _capture_screen_cached(region, monitor, _capture_epoch)


@lru_cache(maxsize=32)
def _capture_screen_cached(
    region: Optional[Tuple[int, int, int, int]],
    monitor: int,
    epoch: int,
) -> "Any":
    """Actual capture, memoised on (region, monitor, epoch).

    ``epoch`` is bumped by :func:`_invalidate_capture_cache` whenever the
    screen contents change (scroll, click, key press), so stale frames are
    never returned.
    """
    try:
        from PIL import ImageGrab

        if region is not None:
            img = ImageGrab.grab(bbox=region, all_screens=True)
        else:
            img = ImageGrab.grab(all_screens=True)
        return img
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Screen capture failed: {e}")


# Keep the legacy name so any other module that imported _capture still works.
def _capture() -> "Any":
    """Capture the full virtual screen as a PIL Image (legacy wrapper)."""
    return capture_screen()


def _capture_region(bbox):
    """Capture a screen region as a PIL Image (unified backend)."""
    return capture_screen(region=bbox)


def _active_window_bbox():
    """Return (left, top, right, bottom) of the foreground window, or None."""
    try:
        import win32gui

        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return None
        rect = win32gui.GetWindowRect(hwnd)  # (l, t, r, b)
        return rect
    except Exception:
        return None


def _active_window_title() -> str:
    try:
        import win32gui

        hwnd = win32gui.GetForegroundWindow()
        return win32gui.GetWindowText(hwnd) if hwnd else ""
    except Exception:
        return ""


def _image_to_b64(img, fmt="PNG", quality=70) -> str:
    buf = io.BytesIO()
    if fmt.upper() == "JPEG":
        img.convert("RGB").save(buf, format="JPEG", quality=quality)
    else:
        img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _image_size_kb(img) -> int:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return len(buf.getvalue()) // 1024


def _run_ocr(img) -> str:
    try:
        import pytesseract
    except ImportError:
        raise ToolError(
            "OCR unavailable: the 'pytesseract' package is not installed."
        )
    # Ensure the Tesseract binary is discoverable.
    exe = os.environ.get("TESSERACT_PATH") or _find_tesseract_exe()
    if exe:
        pytesseract.pytesseract.tesseract_cmd = exe
    try:
        return pytesseract.image_to_string(img)
    except Exception as e:  # noqa: BLE001
        raise ToolError(
            "OCR failed (is the Tesseract engine installed?). Detail: " + str(e)
        )


def _find_tesseract_exe() -> Optional[str]:
    candidates = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _trim_ocr(text: str, max_chars: int = 1500) -> str:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    out = "\n".join(lines)
    if len(out) > max_chars:
        out = out[:max_chars] + "…"
    return out


@register("takeScreenshot")
def take_screenshot(args: Dict[str, Any]) -> Dict[str, Any]:
    img = capture_screen()
    include_image = bool(args.get("include_image", False))
    result: Dict[str, Any] = {
        "result": f"Captured screen ({img.width}x{img.height}).",
        "width": img.width,
        "height": img.height,
    }
    if include_image:
        # Downscale + JPEG to keep payload small for the WS bridge.
        max_dim = int(args.get("max_dim", 1280))
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            img_small = img.resize(
                (max(1, int(img.width * ratio)), max(1, int(img.height * ratio)))
            )
        else:
            img_small = img
        result["image_base64"] = _image_to_b64(img_small, fmt="JPEG", quality=60)
        result["image_mime"] = "image/jpeg"
    return result


@register("saveScreenshot")
def save_screenshot(args: Dict[str, Any]) -> Dict[str, Any]:
    img = capture_screen()
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    name = args.get("name")
    fname = f"{name}-{stamp}.png" if name else f"screenshot-{stamp}.png"
    out_path = SCREENSHOTS_DIR / fname
    img.save(out_path, format="PNG")
    return {"result": f"Saved screenshot to {out_path}.", "path": str(out_path)}


@register("analyzeScreenshot")
def analyze_screenshot(args: Dict[str, Any]) -> Dict[str, Any]:
    img = capture_screen()
    try:
        text = _run_ocr(img)
    except ToolError as e:
        return {"result": f"Screenshot captured, but OCR unavailable: {e.message}"}
    return {
        "result": "Screenshot analyzed via OCR.",
        "text": _trim_ocr(text, int(args.get("max_chars", 1500))),
    }


@register("readScreen")
def read_screen(args: Dict[str, Any]) -> Dict[str, Any]:
    """OCR the active window and report its title plus visible text.

    Uses the hybrid OCR pipeline (Tesseract + EasyOCR cascade) from
    tools_visual for consistency with the clickOnText engine, falling back
    to a simple pytesseract call if the hybrid path is unavailable.
    """
    title = _active_window_title()
    bbox = _active_window_bbox()
    if bbox:
        try:
            img = capture_screen(region=bbox)
        except ToolError:
            img = capture_screen()
    else:
        img = capture_screen()

    # Try the hybrid OCR pipeline (Tesseract + EasyOCR, preprocessed)
    text = ""
    try:
        from .tools_visual import _ocr_best
        words = _ocr_best(img, lang="auto")
        if words:
            text = " ".join(w["text"] for w in words)
    except Exception:
        pass

    # Fallback to simple pytesseract if the hybrid pipeline is unavailable
    if not text:
        try:
            text = _run_ocr(img)
        except ToolError as e:
            return {
                "result": f"Active window: {title or 'unknown'}. OCR unavailable: {e.message}",
                "active_window": title,
            }
    visible = _trim_ocr(text, int(args.get("max_chars", 1500))) or "(no readable text)"
    return {
        "result": f"Active window '{title or 'unknown'}' contains readable text.",
        "active_window": title,
        "text": visible,
    }


__all__ = [
    "capture_screen",
    "get_dpi_scaling",
    "_invalidate_capture_cache",
    "take_screenshot",
    "save_screenshot",
    "analyze_screenshot",
    "read_screen",
]
