"""
UI Automation smoke test.

Verifies the tools_uia module by launching Notepad, locating the "File" menu
item via the Accessibility tree, clicking it, and confirming a menu opened
(by detecting the 'New', 'Open', or 'Save' items that appear).

This is an end-to-end test — it drives a real window — so run it on a desktop
session (not over SSH/headless).

Run:  python -m desktop_agent.test_uia
"""

from __future__ import annotations

import subprocess
import sys
import time


def _info(msg: str) -> None:
    print(f"[ok] {msg}")


def _fail(msg: str) -> None:
    print(f"[FAIL] {msg}", file=sys.stderr)


def main() -> int:
    from .tools_uia import (
        _uia_available,
        find_uia_element,
        get_foreground_window_uia,
        get_foreground_window_info,
        click_on_uia,
        get_cursor_position,
        cursor_is_over,
        list_uia_elements,
    )

    failures = 0

    # ── 0. Dependency check ──────────────────────────────────────────────────
    if not _uia_available():
        _fail("uiautomation library not installed — pip install uiautomation")
        return 1
    _info("uiautomation available")

    # ── 1. Launch Notepad ─────────────────────────────────────────────────────
    try:
        subprocess.Popen(["notepad.exe"])
        _info("launched notepad.exe")
    except Exception as e:
        _fail(f"could not launch notepad: {e}")
        return 1

    # Give the window a moment to appear and paint, then actively focus it.
    # Notepad may not steal focus from the terminal that launched the test,
    # so we find its HWND and bring it to front explicitly.
    import ctypes
    notepad_hwnd = 0
    for _ in range(10):
        time.sleep(0.6)
        try:
            _np_found: list = []

            def _find_np(hwnd, _lparam, _acc=_np_found):
                try:
                    if ctypes.windll.user32.IsWindowVisible(hwnd):
                        buf = ctypes.create_unicode_buffer(256)
                        ctypes.windll.user32.GetWindowTextW(hwnd, buf, 256)
                        title = buf.value or ""
                        if "notepad" in title.lower() or title == "Untitled - Notepad":
                            _acc.append(hwnd)
                except Exception:
                    pass
                return True

            # Win32 EnumWindows expects a plain C callback; use a closure.
            CMPFUNC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
            ctypes.windll.user32.EnumWindows(CMPFUNC(_find_np), 0)
            if _np_found:
                notepad_hwnd = _np_found[0]
                ctypes.windll.user32.ShowWindow(notepad_hwnd, 9)  # SW_RESTORE
                ctypes.windll.user32.SetForegroundWindow(notepad_hwnd)
                break
        except Exception:
            pass

    if not notepad_hwnd:
        # Notepad may already have focus — that's fine, treat as soft-fail.
        _info("could not enumerate Notepad HWND, but it may be focused already")
    else:
        time.sleep(0.8)  # let the activate settle

    # ── 2. Foreground window is Notepad? ──────────────────────────────────────
    info = get_foreground_window_info()
    if not info or "notepad" not in (info.get("name") or "").lower():
        _fail(f"foreground window is not Notepad (got: {info})")
        failures += 1
    else:
        _info(f"foreground window: '{info['name']}'")

    # ── 3. Find the 'File' menu via UIA ────────────────────────────────────────
    file_el = find_uia_element({"text": "File", "control_type": "MenuItem"},
                                search_depth=4, threshold=0.9)
    if not file_el:
        # Notepad on some Windows builds exposes it as a generic 'MenuBarItem'
        # or just a Name match — relax the control type.
        file_el = find_uia_element({"text": "File"}, search_depth=4, threshold=0.9)
    if not file_el:
        _fail("could not find 'File' menu item via UIA")
        failures += 1
    else:
        _info(f"found File menu at ({file_el['x']},{file_el['y']}) "
              f"type={file_el.get('control_type')}")

    # ── 4. Cursor helpers ──────────────────────────────────────────────────────
    cx, cy = get_cursor_position()
    if cx >= 0 and cy >= 0:
        _info(f"cursor position: ({cx},{cy})")
    else:
        _fail(f"get_cursor_position returned ({cx},{cy})")
        failures += 1

    if file_el:
        inside = cursor_is_over(file_el["box"])
        _info(f"cursor_is_over(File box) = {inside}  (likely False before clicking)")

    # ── 5. Click 'File' and verify a submenu opened ────────────────────────────
    if file_el:
        clicked = click_on_uia("File", control_type="MenuItem",
                                exact=False, verify=True)
        if not clicked:
            clicked = click_on_uia("File", exact=False, verify=True)
        if not clicked:
            _fail("click_on_uia('File') returned None")
            failures += 1
        else:
            _info(f"clicked File at ({clicked['x']},{clicked['y']})")
            # A menu should now be visible — look for 'New' / 'Open' / 'Save'.
            time.sleep(0.6)
            menu_item = None
            for label in ("New", "Open", "Save", "New Ctrl+N", "Page Setup"):
                menu_item = find_uia_element({"text": label, "control_type": "MenuItem"},
                                              search_depth=4, threshold=0.9)
                if not menu_item:
                    menu_item = find_uia_element({"text": label},
                                                  search_depth=4, threshold=0.9)
                if menu_item:
                    break
            if menu_item:
                _info(f"menu opened — found '{menu_item['matched_text']}' after clicking File")
            else:
                _fail("clicked File but no submenu item (New/Open/Save) appeared")
                failures += 1

            # Close the menu (press Escape) so we don't leave Notepad in a weird state.
            try:
                import pyautogui
                pyautogui.press("escape")
            except Exception:
                pass

    # ── 6. list_uia_elements sanity ─────────────────────────────────────────────
    elements = list_uia_elements(max_depth=2, limit=20)
    if elements:
        _info(f"list_uia_elements returned {len(elements)} element(s) "
              f"(sample: {[e.get('matched_text') for e in elements[:3]]})")
    else:
        _fail("list_uia_elements returned nothing")
        failures += 1

    # ── Cleanup: close Notepad ─────────────────────────────────────────────────
    try:
        subprocess.run(["taskkill", "/IM", "notepad.exe", "/F"],
                       capture_output=True, timeout=5)
    except Exception:
        pass

    print()
    if failures == 0:
        print("All UIA tests passed.")
        return 0
    print(f"{failures} UIA test(s) failed.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    if __package__ in (None, ""):
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from desktop_agent.tools_uia import (  # type: ignore
            _uia_available, find_uia_element, get_foreground_window_uia,
            get_foreground_window_info, click_on_uia, get_cursor_position,
            cursor_is_over, list_uia_elements,
        )
        sys.exit(main())
    sys.exit(main())
