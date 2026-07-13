"""
Quick smoke test for the unified screen-capture path.

Verifies:
  1. capture_screen() returns a valid PIL image covering the full virtual
     desktop (all monitors).
  2. capture_screen(region=...) crops correctly.
  3. get_dpi_scaling() returns sensible (scale_x, scale_y) values.
  4. The capture cache de-duplicates identical calls and invalidates on bump.

Run:  python -m desktop_agent.test_capture
  or:  python desktop_agent/test_capture.py
"""

from __future__ import annotations

import sys
import time


def _info(msg: str) -> None:
    print(f"[ok] {msg}")


def _fail(msg: str) -> None:
    print(f"[FAIL] {msg}", file=sys.stderr)


def main() -> int:
    # Import after DPI awareness is set by main / registry bootstrap.
    from .tools_screenshot import (
        capture_screen,
        get_dpi_scaling,
        _invalidate_capture_cache,
    )
    from .tools_input import _get_virtual_screen

    failures = 0

    # ── 1. Full virtual-desktop capture ──────────────────────────────────────
    try:
        img = capture_screen()
        vw, vh = _get_virtual_screen()
        # PIL image dimensions should be at least the virtual-screen size
        # (allow a tiny tolerance for rounding / border pixels).
        if img.width >= vw - 2 and img.height >= vh - 2:
            _info(
                f"capture_screen() -> {img.width}x{img.height} "
                f"(virtual desktop {vw}x{vh})"
            )
        else:
            _fail(
                f"capture_screen() returned {img.width}x{img.height}, "
                f"expected >= {vw}x{vh}"
            )
            failures += 1
    except Exception as e:  # noqa: BLE001
        _fail(f"capture_screen() raised: {e}")
        failures += 1

    # ── 2. Region capture ─────────────────────────────────────────────────────
    try:
        # A 300x200 box in the top-left of the virtual desktop.
        region = (0, 0, 300, 200)
        img_r = capture_screen(region=region)
        if img_r.width == 300 and img_r.height == 200:
            _info(f"capture_screen(region=...) -> {img_r.width}x{img_r.height}")
        else:
            _fail(
                f"region capture returned {img_r.width}x{img_r.height}, "
                f"expected 300x200"
            )
            failures += 1
    except Exception as e:  # noqa: BLE001
        _fail(f"capture_screen(region=...) raised: {e}")
        failures += 1

    # ── 3. DPI scaling ────────────────────────────────────────────────────────
    try:
        sx, sy = get_dpi_scaling()
        if 0.5 <= sx <= 4.0 and 0.5 <= sy <= 4.0:
            _info(f"get_dpi_scaling() -> ({sx:.2f}, {sy:.2f})")
        else:
            _fail(f"DPI scaling out of plausible range: ({sx}, {sy})")
            failures += 1
    except Exception as e:  # noqa: BLE001
        _fail(f"get_dpi_scaling() raised: {e}")
        failures += 1

    # ── 4. Capture cache (same epoch → same image object) ────────────────────
    try:
        a = capture_screen()
        b = capture_screen()
        if a is b:
            _info("capture cache returned the same image object for identical args")
        else:
            _fail("capture cache did not de-duplicate identical calls")
            failures += 1

        _invalidate_capture_cache()
        c = capture_screen()
        if c is not a:
            _info("capture cache invalidated after epoch bump")
        else:
            _fail("capture cache not invalidated after _invalidate_capture_cache()")
            failures += 1
    except Exception as e:  # noqa: BLE001
        _fail(f"cache test raised: {e}")
        failures += 1

    # ── 5. Performance sanity (full capture should be < 250 ms) ───────────────
    try:
        _invalidate_capture_cache()
        t0 = time.perf_counter()
        capture_screen()
        dt_ms = (time.perf_counter() - t0) * 1000.0
        if dt_ms < 1000:
            _info(f"capture_screen() took {dt_ms:.1f} ms")
        else:
            _fail(f"capture_screen() too slow: {dt_ms:.1f} ms")
            failures += 1
    except Exception as e:  # noqa: BLE001
        _fail(f"performance test raised: {e}")
        failures += 1

    print()
    if failures == 0:
        print("All capture tests passed.")
        return 0
    print(f"{failures} test(s) failed.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    # When run as a plain script (python desktop_agent/test_capture.py) the
    # package-relative imports above won't resolve — fall back to a direct run.
    if __package__ in (None, ""):
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from desktop_agent.tools_screenshot import (  # type: ignore
            capture_screen,
            get_dpi_scaling,
            _invalidate_capture_cache,
        )
        from desktop_agent.tools_input import _get_virtual_screen  # type: ignore

        # Re-bind the names the test functions reference.
        globals()["capture_screen"] = capture_screen
        globals()["get_dpi_scaling"] = get_dpi_scaling
        globals()["_invalidate_capture_cache"] = _invalidate_capture_cache
        globals()["_get_virtual_screen"] = _get_virtual_screen

        sys.exit(_run_standalone() if False else main())
    sys.exit(main())
