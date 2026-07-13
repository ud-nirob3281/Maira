"""
UI Automation helpers — robust UI element search via the Windows Accessibility tree.

Built on the ``uiautomation`` library (a Pythonic wrapper over the Microsoft
UI Automation COM API).  UIA is the *gold standard* for locating Windows UI
elements because it exposes the accessibility tree that every modern app
(WPF, UWP, Electron, Win32, Chromium, …) publishes.  Unlike pixel/OCR clicks,
UIA targets survive display-scaling changes, window moves, and theme switches.

This module is dependency-optional: if ``uiautomation`` is not installed
every function returns ``None`` / ``False`` so callers can fall back to OCR
or Playwright.  It never raises on a missing dependency.

Public API
----------
find_uia_element(condition, search_depth=5)
    Locate an element by name / control type / automation id.
get_foreground_window_uia()
    Return the UIA element of the active window.
click_on_uia(text, control_type=None, exact=False, ...)
    Find + click an element in one call (uses uiautomation.Click()).
list_uia_elements(max_depth=3, ...)
    Enumerate interactive elements of the foreground window.
get_cursor_position()
    Current (x, y) cursor location (Win32 GetCursorPos).
cursor_is_over(rect)
    True if the cursor is inside the given rectangle.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from .registry import ToolError, register


# ── Availability check ────────────────────────────────────────────────────────

def _uia_available() -> bool:
    try:
        import uiautomation  # noqa: F401
        return True
    except Exception:
        return False


# ── Window helpers ────────────────────────────────────────────────────────────

def get_foreground_window_uia():
    """Return the UIA Control for the foreground window, or None.

    Returns the raw ``uiautomation`` control object (not a dict) so callers
    can traverse its children directly.  Falls back to the desktop root if no
    foreground window is reported.
    """
    if not _uia_available():
        return None
    try:
        import uiautomation as ua
        # uiautomation.GetForegroundWindow() returns the raw HWND in some
        # versions — normalize via ControlFromHandle so we always get a Control.
        fg = ua.GetForegroundWindow()
        if isinstance(fg, int) and fg:
            fg = ua.ControlFromHandle(fg)
        if fg is not None:
            return fg
        # Last-resort fallback: desktop root.
        return ua.GetRootControl()
    except Exception:
        try:
            return ua.GetRootControl()  # type: ignore[name-defined]
        except Exception:
            return None


def get_foreground_window_info() -> Optional[Dict[str, Any]]:
    """Return {name, rect, handle} of the foreground window, or None."""
    try:
        fg = get_foreground_window_uia()
        if not fg:
            return None
        rect = fg.BoundingRectangle
        if not rect:
            return None
        try:
            handle = int(fg.NativeWindowHandle) if fg.NativeWindowHandle else 0
        except Exception:
            handle = 0
        return {
            "name": fg.Name or "",
            "handle": handle,
            "rect": {
                "left": rect.left, "top": rect.top,
                "right": rect.right, "bottom": rect.bottom,
                "width": rect.right - rect.left,
                "height": rect.bottom - rect.top,
            },
        }
    except Exception:
        return None


# ── Tree walker ───────────────────────────────────────────────────────────────

def _walk(ctrl, max_depth: int = 5):
    """BFS generator yielding (control, depth) pairs up to *max_depth*.

    Uses ``GetChildren`` so it works with any UIA control.  Defensive against
    controls that raise on access (Electron custom-drawn regions, etc.).
    """
    from collections import deque
    if ctrl is None:
        return
    queue = deque([(ctrl, 0)])
    while queue:
        c, d = queue.popleft()
        yield c, d
        if d < max_depth:
            try:
                children = c.GetChildren() or []
            except Exception:
                children = []
            for ch in children:
                queue.append((ch, d + 1))


def _ctrl_to_dict(ctrl, score: float = 0.0) -> Optional[Dict[str, Any]]:
    """Convert a UIA control to the standard element dict used across MYRAA."""
    if ctrl is None:
        return None
    try:
        rect = ctrl.BoundingRectangle
        if not rect:
            return None
        cx = (rect.left + rect.right) // 2
        cy = (rect.top + rect.bottom) // 2
        return {
            "x": cx,
            "y": cy,
            "box": {
                "left": rect.left,
                "top": rect.top,
                "width": rect.right - rect.left,
                "height": rect.bottom - rect.top,
            },
            "confidence": score,
            "method": "uiautomation",
            "matched_text": (ctrl.Name or "").strip(),
            "control_type": _ctrl_type(ctrl),
            "automation_id": (ctrl.AutomationId or "").strip(),
            "control": ctrl,  # keep a handle so callers can Click() it
        }
    except Exception:
        return None


def _ctrl_type(ctrl) -> str:
    """Return a short control-type name (e.g. 'Button', 'MenuItem')."""
    try:
        ct = ctrl.ControlTypeName or ""
        return ct.replace("Control", "")
    except Exception:
        return ""


def _name_matches(haystack: str, needle: str, exact: bool) -> bool:
    """Case-insensitive exact or substring match."""
    if not haystack or not needle:
        return False
    h = haystack.strip()
    if exact:
        return h.lower() == needle.lower()
    return needle.lower() in h.lower()


def _fuzzy(a: str, b: str) -> float:
    """0..1 fuzzy similarity between two strings (rapidfuzz → difflib)."""
    try:
        from rapidfuzz import fuzz
        return max(fuzz.ratio(a, b), fuzz.partial_ratio(a, b)) / 100.0
    except Exception:
        import difflib
        return difflib.SequenceMatcher(None, a, b).ratio()


# ── Primary search ────────────────────────────────────────────────────────────

def find_uia_element(
    condition: Dict[str, Any],
    search_depth: int = 5,
    threshold: float = 0.6,
) -> Optional[Dict[str, Any]]:
    """Locate a UI element by combining several matching criteria.

    Parameters
    ----------
    condition :
        Dict supporting any of:
          text      → match against element Name (exact=False by default)
          name      → alias for *text*
          exact     → if True, require exact name match
          control_type → e.g. 'Button', 'MenuItem', 'CheckBox', 'Edit'
          automation_id → element AutomationId (very reliable)
    search_depth :
        Max BFS depth from the foreground window root.
    threshold :
        Minimum fuzzy score for partial text matches.

    Returns the standard element dict (with a live ``control`` handle) or None.

    Matching priority (first hit wins):
        1. AutomationId exact match
        2. ControlType + Name exact match
        3. Name fuzzy match >= threshold
        4. ControlType only (returns first of that type)
    """
    if not _uia_available():
        return None

    text = condition.get("text") or condition.get("name")
    exact = bool(condition.get("exact", False))
    control_type = (condition.get("control_type") or "").replace("Control", "")
    automation_id = condition.get("automation_id")

    root = get_foreground_window_uia()
    if root is None:
        return None

    best: Optional[Dict[str, Any]] = None
    best_score = 0.0

    for ctrl, _depth in _walk(root, max_depth=search_depth):
        try:
            # 1. AutomationId exact match — highest reliability
            if automation_id:
                aid = (ctrl.AutomationId or "").strip()
                if aid and aid == automation_id:
                    return _ctrl_to_dict(ctrl, 1.0)

            ctype = _ctrl_type(ctrl)
            name = (ctrl.Name or "").strip()

            # 2. ControlType + Name exact
            if control_type and ctype == control_type and text:
                if _name_matches(name, text, exact=True):
                    return _ctrl_to_dict(ctrl, 1.0)

            # 3. Name fuzzy match
            if text and name:
                if exact:
                    if _name_matches(name, text, exact=True):
                        return _ctrl_to_dict(ctrl, 1.0)
                else:
                    score = _fuzzy(name, text)
                    if score >= threshold and score > best_score:
                        best_score = score
                        best = _ctrl_to_dict(ctrl, score)

            # 4. ControlType only (first of its kind)
            if control_type and ctype == control_type and not text:
                if best is None:
                    best = _ctrl_to_dict(ctrl, 0.5)
        except Exception:
            continue

    return best


# ── Click via UIA ─────────────────────────────────────────────────────────────

def _click_ctrl(ctrl, double: bool = False) -> bool:
    """Click a UIA control. Tries Click() pattern first, then coordinates.

    ``uiautomation.Click(x, y)`` uses real hardware-level mouse events that
    work in ALL apps (UWP, Electron, Win32).  We prefer the UIA ``Click()``
    method when available (it's coordinate-free and survives window moves),
    then fall back to a coordinate click via the input module.
    """
    try:
        import uiautomation as ua
        rect = ctrl.BoundingRectangle
        if not rect:
            return False
        # UIA's own Click() — hardware-independent.
        if double:
            try:
                ctrl.DoubleClick()
                return True
            except Exception:
                pass
        try:
            ctrl.Click()
            return True
        except Exception:
            pass
        # Coordinate fallback through the shared input layer.
        from .tools_input import _smooth_move, _win32_click, _win32_double_click
        cx = (rect.left + rect.right) // 2
        cy = (rect.top + rect.bottom) // 2
        _smooth_move(cx, cy, duration=0.2)
        time.sleep(0.08)
        if double:
            _win32_double_click("left", cx, cy)
        else:
            _win32_click("left", cx, cy)
        return True
    except Exception:
        return False


def click_on_uia(
    text: str,
    control_type: Optional[str] = None,
    exact: bool = False,
    search_depth: int = 5,
    double: bool = False,
    verify: bool = True,
) -> Optional[Dict[str, Any]]:
    """Find an element by name/control type and click it via UIA.

    Parameters
    ----------
    text :
        Visible label (e.g. 'File', 'Save', 'OK').
    control_type :
        Optional filter — e.g. 'Button', 'MenuItem', 'CheckBox'.
    exact :
        Require an exact name match (default substring/fuzzy).
    search_depth :
        BFS depth from the foreground window.
    double :
        Double-click instead of single.
    verify :
        If True, move the cursor onto the element before clicking and confirm
        it ended up inside the bounding box (guards against accidental clicks).

    Returns the element dict (including clicked x,y) or None if not found.
    """
    el = find_uia_element(
        {"text": text, "control_type": control_type, "exact": exact},
        search_depth=search_depth,
    )
    if not el:
        return None

    ctrl = el.get("control")
    if ctrl is None:
        return None

    # Optional verification: park the cursor on the element first.
    if verify:
        try:
            from .tools_input import _smooth_move, _win32_get_pos
            _smooth_move(el["x"], el["y"], duration=0.18)
            time.sleep(0.06)
            ax, ay = _win32_get_pos()
            box = el["box"]
            if not (box["left"] - 10 <= ax <= box["left"] + box["width"] + 10
                    and box["top"] - 10 <= ay <= box["top"] + box["height"] + 10):
                # Cursor drifted off-target — abort to avoid a bad click.
                return None
        except Exception:
            pass

    ok = _click_ctrl(ctrl, double=double)
    if not ok:
        return None
    el = dict(el)
    el["clicked"] = True
    return el


# ── Cursor helpers ────────────────────────────────────────────────────────────

def get_cursor_position() -> Tuple[int, int]:
    """Current cursor (x, y) in physical screen coordinates."""
    try:
        import ctypes
        class _POINT(ctypes.Structure):
            _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]
        pt = _POINT()
        ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
        return pt.x, pt.y
    except Exception:
        return (-1, -1)


def cursor_is_over(rect: Dict[str, int]) -> bool:
    """True if the cursor lies within the given rect dict ({left,top,width,height})."""
    x, y = get_cursor_position()
    if x < 0:
        return False
    return (rect["left"] <= x <= rect["left"] + rect["width"]
            and rect["top"] <= y <= rect["top"] + rect["height"])


# ── Element listing (useful for debugging / Gemini Vision pairing) ────────────

def list_uia_elements(
    max_depth: int = 3,
    control_types: Optional[List[str]] = None,
    name_filter: Optional[str] = None,
    limit: int = 60,
) -> List[Dict[str, Any]]:
    """Enumerate interactive elements of the foreground window.

    Returns a list of element dicts (without the live ``control`` handle so
    they are JSON-serializable for the tool API).
    """
    if not _uia_available():
        return []
    root = get_foreground_window_uia()
    if root is None:
        return []

    ct_set = {c.replace("Control", "") for c in control_types} if control_types else None
    out: List[Dict[str, Any]] = []
    for ctrl, _depth in _walk(root, max_depth=max_depth):
        try:
            ctype = _ctrl_type(ctrl)
            if ct_set and ctype not in ct_set:
                continue
            name = (ctrl.Name or "").strip()
            if name_filter and name_filter.lower() not in name.lower():
                continue
            d = _ctrl_to_dict(ctrl, 0.0)
            if d:
                d.pop("control", None)  # strip live handle for serialization
                out.append(d)
                if len(out) >= limit:
                    break
        except Exception:
            continue
    return out


# ── Registered tools (added to the agent's tool set) ─────────────────────────

@register("clickUIAElement")
def click_uia_element(args: Dict[str, Any]) -> Dict[str, Any]:
    """Find and click a UI element via the Windows Accessibility tree.

    Examples:
      text='File'                    → click the File menu in the active app
      text='Save', control_type='MenuItem'
      text='OK', control_type='Button'
    """
    text = args.get("text") or args.get("name") or args.get("label")
    if not text:
        raise ToolError("Parameter 'text' (element label) is required.")
    control_type = args.get("control_type") or args.get("controlType")
    exact = bool(args.get("exact", False))
    double = bool(args.get("double", False))
    search_depth = int(args.get("search_depth", 5))

    if not _uia_available():
        raise ToolError(
            "UI Automation is not available. Install with: "
            "pip install uiautomation"
        )

    el = click_on_uia(str(text), control_type=control_type, exact=exact,
                      double=double, search_depth=search_depth)
    if not el:
        raise ToolError(
            f"Could not find a UI element named '{text}'"
            + (f" of type {control_type}" if control_type else "")
            + " in the foreground window."
        )
    return {
        "result": f"Clicked '{el['matched_text']}' ({el.get('control_type','')}) "
                  f"at ({el['x']},{el['y']}) via UI Automation.",
        "x": el["x"],
        "y": el["y"],
        "method": "uiautomation",
        "confidence": el["confidence"],
        "control_type": el.get("control_type", ""),
        "matched_text": el["matched_text"],
    }


@register("findUIAElement")
def find_uia_element_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """Find (without clicking) a UI element by name/control type via UIA."""
    text = args.get("text") or args.get("name") or args.get("label")
    if not text:
        raise ToolError("Parameter 'text' is required.")
    control_type = args.get("control_type") or args.get("controlType")
    exact = bool(args.get("exact", False))
    search_depth = int(args.get("search_depth", 5))

    if not _uia_available():
        raise ToolError("UI Automation is not available.")

    el = find_uia_element(
        {"text": text, "control_type": control_type, "exact": exact},
        search_depth=search_depth,
    )
    if not el:
        return {"result": f"No UI element matching '{text}' found.", "found": False}
    el_out = {k: v for k, v in el.items() if k != "control"}
    return {
        "result": f"Found '{el['matched_text']}' ({el.get('control_type','')}) "
                  f"at ({el['x']},{el['y']}).",
        "found": True,
        **el_out,
    }


@register("listUIElements")
def list_ui_elements_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """List interactive UI elements of the foreground window (Accessibility tree)."""
    control_types = args.get("control_types") or args.get("controlTypes")
    name_filter = args.get("name_filter") or args.get("nameFilter")
    max_depth = int(args.get("max_depth", 3))
    limit = int(args.get("limit", 60))
    elements = list_uia_elements(
        max_depth=max_depth,
        control_types=control_types,
        name_filter=name_filter,
        limit=limit,
    )
    return {
        "result": f"Found {len(elements)} interactive element(s).",
        "count": len(elements),
        "elements": elements,
    }


__all__ = [
    "find_uia_element",
    "get_foreground_window_uia",
    "get_foreground_window_info",
    "click_on_uia",
    "list_uia_elements",
    "get_cursor_position",
    "cursor_is_over",
    "click_uia_element",
    "find_uia_element_tool",
    "list_ui_elements_tool",
]
