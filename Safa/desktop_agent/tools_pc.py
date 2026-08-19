"""
PC control: system volume and (gated) power actions.

Volume:
  Uses pycaw + comtypes for precise scalar control on Windows when available,
  with a graceful media-key fallback (VK_VOLUME_UP/DOWN/MUTE via keybd_event)
  through pyautogui.

Power:
  shutdown / restart / sleep / lock are DANGEROUS and require the two-step
  confirmation flow (tools_confirmation). `executePowerAction` consumes the
  token before running anything destructive.
"""

from __future__ import annotations

import ctypes
import os
import platform
import subprocess
import time
from typing import Any, Dict, Optional

from .registry import ToolError, register
from .tools_confirmation import ACTION_LABEL, consume_token


# --- Volume backend (lazy) ----------------------------------------------------

_vol_backend = None  # one of "pycaw" | "media_keys" | None


def _init_pycaw():
    try:
        from ctypes import cast, POINTER

        import comtypes  # noqa: F401
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, comtypes.CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))
        return volume
    except Exception:
        return None


def _get_volume_interface():
    global _vol_backend
    if _vol_backend is None:
        if platform.system() != "Windows":
            _vol_backend = "media_keys"
        else:
            iface = _init_pycaw()
            _vol_backend = "pycaw" if iface is not None else "media_keys"
            if _vol_backend == "pycaw":
                _VOL_CACHE["iface"] = iface
    return _vol_backend


_VOL_CACHE: Dict[str, Any] = {}


def _current_volume() -> Optional[float]:
    """Returns current master volume in 0.0..1.0, or None if unreadable.

    Previously returned a hardcoded 0.5 when pycaw was unavailable — every
    relative adjustment then computed against a fictional baseline, and
    'what's the volume?' got answered with a guess. Callers must now handle
    None honestly.
    """
    backend = _get_volume_interface()
    if backend == "pycaw":
        iface = _VOL_CACHE.get("iface") or _init_pycaw()
        if iface is not None:
            _VOL_CACHE["iface"] = iface
            try:
                return float(iface.GetMasterVolumeLevelScalar())
            except Exception:
                # Stale endpoint (audio device switched) — re-init once.
                _VOL_CACHE["iface"] = iface = _init_pycaw()
                if iface is not None:
                    try:
                        return float(iface.GetMasterVolumeLevelScalar())
                    except Exception:
                        pass
    return None


def _volume_step_percent(args: Dict[str, Any]) -> float:
    """Step size in PERCENTAGE POINTS (0-100).

    Accepts the declared `amount_percent` (e.g. 5 => exactly +5%) or the legacy
    `amount` fraction (0.05 => 5). Default 10.
    """
    if "amount_percent" in args:
        pct = float(args["amount_percent"])
    elif "amount" in args:
        legacy = float(args["amount"])
        # Legacy semantic: fraction 0..1 → percent; anything above 1 was
        # already (incorrectly) meant as percent.
        pct = legacy * 100.0 if 0 < legacy <= 1 else legacy
    else:
        pct = 10.0
    return max(0.0, min(100.0, pct))


def _set_volume_scalar(value: float) -> None:
    value = max(0.0, min(1.0, float(value)))
    backend = _get_volume_interface()
    if backend == "pycaw":
        iface = _VOL_CACHE.get("iface") or _init_pycaw()
        if iface is not None:
            _VOL_CACHE["iface"] = iface
            try:
                iface.SetMasterVolumeLevelScalar(value, None)
                return
            except Exception:
                pass  # fall through to media keys
    _set_volume_via_keys(value)


# VK codes for media keys
VK_VOLUME_MUTE = 0xAD
VK_VOLUME_UP = 0xAF
VK_VOLUME_DOWN = 0xAE
KEYEVENTF_KEYUP = 0x0002


def _press_vk(vk: int) -> None:
    try:
        ctypes.windll.user32.keybd_event(vk, 0, 0, 0)
        time.sleep(0.03)
        ctypes.windll.user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
    except Exception:
        # pyautogui fallback
        try:
            import pyautogui

            if vk == VK_VOLUME_UP:
                pyautogui.press("volumeup")
            elif vk == VK_VOLUME_DOWN:
                pyautogui.press("volumedown")
            elif vk == VK_VOLUME_MUTE:
                pyautogui.press("volumemute")
        except Exception:
            pass


def _set_volume_via_keys(target: float) -> None:
    """Approximate target volume by stepping media keys. Coarse but reliable."""
    current = _current_volume()
    if current is None:
        # No readable audio endpoint (e.g. headless session) — an EXACT set is
        # impossible from an unknown baseline. Fail honestly instead of
        # stepping blindly toward 100%.
        raise ToolError(
            "Cannot set an exact volume level on this system (no audio endpoint interface). "
            "Relative volumeUp/volumeDown still work via media keys."
        )
    diff = target - current
    # ~2% per keypress is a reasonable Windows approximation.
    steps = int(abs(diff) / 0.02) + 1
    vk = VK_VOLUME_UP if diff > 0 else VK_VOLUME_DOWN
    for _ in range(min(steps, 50)):
        _press_vk(vk)
        time.sleep(0.01)


def _toggle_mute_pycaw() -> bool:
    iface = _VOL_CACHE.get("iface")
    if iface is None:
        iface = _init_pycaw()
    if iface is not None:
        _VOL_CACHE["iface"] = iface
        try:
            iface.SetMute(1 if not bool(iface.GetMute()) else 0, None)
            return bool(iface.GetMute())
        except Exception:
            pass
    _press_vk(VK_VOLUME_MUTE)
    time.sleep(0.05)
    return False


# --- Tool handlers -----------------------------------------------------------


@register("getVolume")
def get_volume(args: Dict[str, Any]) -> Dict[str, Any]:
    """Read the ACTUAL current system volume — for 'volume এখন কত?' questions."""
    v = _current_volume()
    if v is None:
        raise ToolError(
            "Cannot read the current system volume on this machine (no audio endpoint interface). "
            "Do NOT guess a value — tell the user the exact volume level is unreadable right now."
        )
    pct = int(round(v * 100))
    return {"result": f"Current system volume is {pct}%.", "volume": pct}


@register("volumeUp")
def volume_up(args: Dict[str, Any]) -> Dict[str, Any]:
    step_pct = _volume_step_percent(args)
    current = _current_volume()
    if current is not None:
        new = min(1.0, current + step_pct / 100.0)
        _set_volume_scalar(new)
        # Read-back verification — report the ACTUAL device value, not the
        # computed one.
        verified = _current_volume()
        v = int(round((verified if verified is not None else new) * 100))
        return {
            "result": f"Volume increased by {int(step_pct)}% — now {v}% (verified from device).",
            "volume": v,
        }
    # pycaw unavailable: approximate via media keys, honestly labeled.
    presses = max(1, int(round(step_pct / 2.0)))
    for _ in range(min(presses, 50)):
        _press_vk(VK_VOLUME_UP)
        time.sleep(0.01)
    return {
        "result": f"Volume increased by ~{int(step_pct)}% (approximate — exact level is unreadable on this system).",
        "volume": None,
    }


@register("volumeDown")
def volume_down(args: Dict[str, Any]) -> Dict[str, Any]:
    step_pct = _volume_step_percent(args)
    current = _current_volume()
    if current is not None:
        new = max(0.0, current - step_pct / 100.0)
        _set_volume_scalar(new)
        verified = _current_volume()
        v = int(round((verified if verified is not None else new) * 100))
        return {
            "result": f"Volume decreased by {int(step_pct)}% — now {v}% (verified from device).",
            "volume": v,
        }
    presses = max(1, int(round(step_pct / 2.0)))
    for _ in range(min(presses, 50)):
        _press_vk(VK_VOLUME_DOWN)
        time.sleep(0.01)
    return {
        "result": f"Volume decreased by ~{int(step_pct)}% (approximate — exact level is unreadable on this system).",
        "volume": None,
    }


@register("setVolume")
def set_volume(args: Dict[str, Any]) -> Dict[str, Any]:
    if "percent" in args:
        pct = float(args["percent"])
    elif "level" in args:
        pct = float(args["level"])
    else:
        raise ToolError("Parameter 'percent' (0-100) is required.")
    pct = max(0.0, min(100.0, pct))
    _set_volume_scalar(pct / 100.0)
    # Read-back verification.
    verified = _current_volume()
    if verified is not None:
        v = int(round(verified * 100))
        return {"result": f"Volume set to {v}% (verified from device).", "volume": v}
    return {
        "result": f"Volume set to approximately {int(pct)}% (exact level unreadable on this system).",
        "volume": int(pct),
    }


@register("muteToggle")
def mute_toggle(args: Dict[str, Any]) -> Dict[str, Any]:
    muted = _toggle_mute_pycaw()
    return {"result": "Muted." if muted else "Unmuted."}


# --- Gated power actions -----------------------------------------------------


def _run_power(action: str) -> str:
    """Execute the actual OS power command. Caller must have confirmed first."""
    system = platform.system()
    if action == "lock":
        if system == "Windows":
            ctypes.windll.user32.LockWorkStation()
            return "Computer locked."
        return "Lock is only configured for Windows."
    if action == "sleep":
        if system == "Windows":
            # suspend: standby
            os.system("rundll32.exe powrprof.dll,SetSuspendState 0,1,0")
            return "Computer going to sleep."
        subprocess.run(["systemctl", "suspend"], check=False)
        return "Computer going to sleep."
    if action == "restart":
        if system == "Windows":
            subprocess.run(["shutdown", "/r", "/f", "/t", "0"], check=False)
            return "Computer restarting immediately."
        elif system == "Darwin":
            subprocess.run(["osascript", "-e", 'tell app "System Events" to restart'], check=False)
            return "Computer restarting."
        else:
            subprocess.run(["systemctl", "reboot"], check=False)
            subprocess.run(["shutdown", "-r", "now"], check=False)
            return "Computer restarting."
    if action == "shutdown":
        if system == "Windows":
            subprocess.run(["shutdown", "/s", "/f", "/t", "0"], check=False)
            return "Computer shutting down immediately."
        elif system == "Darwin":
            subprocess.run(["osascript", "-e", 'tell app "System Events" to shut down'], check=False)
            return "Computer shutting down."
        else:
            subprocess.run(["systemctl", "poweroff"], check=False)
            subprocess.run(["shutdown", "-h", "now"], check=False)
            return "Computer shutting down."
    raise ToolError(f"Unknown power action '{action}'.")


@register("executePowerAction")
def execute_power_action(args: Dict[str, Any]) -> Dict[str, Any]:
    action = (args.get("action") or "").strip().lower()
    # Accept both names: the Gemini-declared schema uses `token`, the original
    # implementation read `execute_token` — the mismatch meant the token was
    # ALWAYS None and every gated power action failed.
    token: Optional[str] = args.get("token") or args.get("execute_token")

    # Locking is comparatively safe but still gated per the user's spec
    # (all four dangerous actions require confirmation).
    from .tools_confirmation import DANGEROUS_ACTIONS

    if action not in DANGEROUS_ACTIONS:
        raise ToolError(
            f"Unknown power action '{action}'. Valid: {', '.join(sorted(DANGEROUS_ACTIONS))}."
        )

    consume_token(action, token)  # raises if invalid/missing/expired
    msg = _run_power(action)
    return {"result": msg, "action": action}


# Helper for shell-level abort of a pending Windows shutdown/restart timer.
@register("_cancelPowerTimer")
def _cancel(args: Dict[str, Any]) -> Dict[str, Any]:  # pragma: no cover
    subprocess.run(["shutdown", "/a"], check=False)
    return {"result": "Cancelled pending shutdown/restart timer."}


# --- Brightness control ------------------------------------------------------
# Uses screen_brightness_control when available (Windows/macOS). Degrades to a
# WMI / powershell fallback on Windows, and to a clear "unsupported" message
# otherwise. Lazy import so the agent still boots if the optional dep is missing.

_sbc = None  # cached module handle

def _brightness_backend():
    """Return the screen_brightness_control module, or None if unavailable."""
    global _sbc
    if _sbc is not None:
        return _sbc if _sbc is not False else None
    try:
        import screen_brightness_control as sbc  # type: ignore[import-not-found]

        _sbc = sbc
        return sbc
    except Exception:  # noqa: BLE001 - optional dependency
        _sbc = False
        return None


def _current_brightness() -> int:
    sbc = _brightness_backend()
    if sbc is not None:
        try:
            vals = sbc.get_brightness()
            if vals:
                return int(round(sum(vals) / len(vals)))
        except Exception:  # noqa: BLE001
            pass
    # Windows WMI fallback via PowerShell (does not need extra deps).
    if platform.system() == "Windows":
        try:
            out = subprocess.check_output(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    "(Get-WmiObject -Namespace root/WMI "
                    "-Class WmiMonitorBrightness).WmiCurrentBrightness",
                ],
                text=True,
                timeout=8,
            ).strip()
            if out:
                return int(out.splitlines()[-1].strip())
        except Exception:  # noqa: BLE001
            pass
    raise ToolError("Brightness control is not supported on this device.")


def _verify_brightness_or_none(target: int) -> Optional[int]:
    """Re-read brightness after a set; return the actual value, or None if the
    display refuses reads (some desktop monitors accept writes only)."""
    try:
        val = _current_brightness()
        # Tolerance: many panels round to their supported step (e.g. 10).
        if abs(val - target) <= 3:
            return val
        return val
    except Exception:  # noqa: BLE001
        return None


def _set_brightness(pct: float) -> int:
    pct = max(0.0, min(100.0, pct))
    sbc = _brightness_backend()
    if sbc is not None:
        try:
            sbc.set_brightness(int(pct))
            return int(pct)
        except Exception:  # noqa: BLE001
            pass
    if platform.system() == "Windows":
        # WMI setter requires a method call; shell out to PowerShell.
        try:
            proc = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    (
                        "$m = Get-WmiObject -Namespace root/WMI "
                        "-Class WmiMonitorBrightnessMethods; "
                        f"$m.WmiSetBrightness(1,{int(pct)})"
                    ),
                ],
                capture_output=True,
                text=True,
                timeout=8,
            )
            # check the actual exit status — previously ran with check=False
            # and claimed success even when the setter failed.
            if proc.returncode != 0:
                err = (proc.stderr or proc.stdout or "").strip()
                raise ToolError(
                    f"Could not set brightness (WMI setter failed: {err[:200] or 'unknown error'})."
                )
            return int(pct)
        except ToolError:
            raise
        except Exception as e:  # noqa: BLE001
            raise ToolError(f"Could not set brightness: {e}") from e
    raise ToolError("Brightness control is not supported on this device.")


@register("getBrightness")
def get_brightness(args: Dict[str, Any]) -> Dict[str, Any]:
    """Read the ACTUAL current screen brightness — for 'brightness এখন কত?'."""
    val = _current_brightness()  # raises an honest ToolError when unsupported
    return {"result": f"Current screen brightness is {val}%.", "brightness": val}


@register("brightnessUp")
def brightness_up(args: Dict[str, Any]) -> Dict[str, Any]:
    step = float(args.get("amount", 10))
    current = _current_brightness()
    new = _set_brightness(current + step)
    verified = _verify_brightness_or_none(new)
    return {
        "result": f"Brightness increased to {verified if verified is not None else new}%.",
        "brightness": verified if verified is not None else new,
    }


@register("brightnessDown")
def brightness_down(args: Dict[str, Any]) -> Dict[str, Any]:
    step = float(args.get("amount", 10))
    current = _current_brightness()
    new = _set_brightness(current - step)
    verified = _verify_brightness_or_none(new)
    return {
        "result": f"Brightness decreased to {verified if verified is not None else new}%.",
        "brightness": verified if verified is not None else new,
    }


@register("setBrightness")
def set_brightness(args: Dict[str, Any]) -> Dict[str, Any]:
    if "percent" in args:
        pct = float(args["percent"])
    elif "level" in args:
        pct = float(args["level"])
    else:
        raise ToolError("Parameter 'percent' (0-100) is required.")
    new = _set_brightness(pct)
    verified = _verify_brightness_or_none(new)
    return {
        "result": f"Brightness set to {verified if verified is not None else new}%.",
        "brightness": verified if verified is not None else new,
    }


@register("clearRecycleBin")
def clear_recycle_bin(args: Dict[str, Any]) -> Dict[str, Any]:
    """Clears the OS Recycle Bin/Trash."""
    system = platform.system()
    if system == "Windows":
        try:
            # SHEmptyRecycleBinW(hwnd, pszRootPath, dwFlags)
            # dwFlags: 7 = SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND
            res = ctypes.windll.shell32.SHEmptyRecycleBinW(None, None, 7)
            return {"result": f"Recycle Bin cleared successfully. (Status: {res})"}
        except Exception as e:
            raise ToolError(f"Failed to clear Recycle Bin: {e}")
    elif system == "Darwin":
        try:
            subprocess.run(["osascript", "-e", 'tell app "Finder" to empty trash'], check=True)
            return {"result": "Recycle Bin cleared successfully."}
        except Exception as e:
            raise ToolError(f"Failed to empty trash: {e}")
    else:
        try:
            subprocess.run(["trash-empty"], check=False)
            subprocess.run(["rm", "-rf", os.path.expanduser("~/.local/share/Trash/*")], check=False)
            return {"result": "Recycle Bin/Trash cleared successfully."}
        except Exception as e:
            raise ToolError(f"Failed to empty trash: {e}")


__all__ = [
    "volume_up",
    "volume_down",
    "set_volume",
    "mute_toggle",
    "execute_power_action",
    "ACTION_LABEL",
    "brightness_up",
    "brightness_down",
    "set_brightness",
    "clear_recycle_bin",
]
