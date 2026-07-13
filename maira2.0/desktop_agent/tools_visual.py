"""
Hybrid Vision Engine + Smart Click Engine.

Click accuracy is paramount. Instead of guessing coordinates, we use a cascade
of methods from highest to lowest confidence:

  1. Playwright browser control - perfect element selection if the automated browser is active.
  2. UI Automation (Windows Accessibility tree) - exact element rectangles,
     works even with display scaling; the gold standard on Windows.
  3. OpenCV Template Matching - exact pixel-level matching for icons/buttons.
  4. Tesseract OCR (preprocessed, OpenCV-enhanced) - fast, accurate text labels.
  5. EasyOCR fallback (PyTorch) - slower but better on stylized/noisy text.

OCR preprocessing pipeline: grayscale → contrast → sharpen → denoise → (OpenCV
adaptive threshold when available). Languages: English, Bangla (ben), Hindi (hin).
Confidence scoring with rapidfuzz fuzzy matching so "Visual Studlo" still
matches "Visual Studio".

All subsystems are designed to degrade gracefully if dependencies are missing.
"""

from __future__ import annotations

import hashlib
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from .registry import STATE, ToolError, register


# ── OCR result cache (500ms TTL, keyed by image MD5) ─────────────────────────
# Avoids re-running expensive OCR during click-drag sequences or repeated
# find_on_screen calls on the same frame.
_OCR_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
_OCR_CACHE_TTL = 0.500  # seconds


def _image_hash(img) -> str:
    """MD5 hash of a PIL image's raw bytes for cache keying."""
    try:
        return hashlib.md5(img.tobytes()).hexdigest()
    except Exception:
        return ""


def _ocr_cached(img, lang: str, engine_fn) -> List[Dict[str, Any]]:
    """Run engine_fn(img, lang) with a 500ms TTL cache keyed on (hash, lang)."""
    key = f"{_image_hash(img)}:{lang}"
    now = time.time()
    cached = _OCR_CACHE.get(key)
    if cached and (now - cached[0]) < _OCR_CACHE_TTL:
        return cached[1]
    result = engine_fn(img, lang)
    _OCR_CACHE[key] = (now, result)
    # Prune expired entries to keep memory bounded.
    if len(_OCR_CACHE) > 64:
        for k in list(_OCR_CACHE):
            if now - _OCR_CACHE[k][0] > _OCR_CACHE_TTL:
                del _OCR_CACHE[k]
    return result


# ── Tesseract path detection ────────────────────────────────────────────────
_TESSERACT_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.join(os.environ.get("LOCALAPPDATA", ""), "Tesseract-OCR", "tesseract.exe"),
]


def _find_tesseract() -> Optional[str]:
    """Return the tesseract executable path, or None if not installed."""
    import shutil
    
    # 1. Check system PATH first
    path_in_env = shutil.which("tesseract")
    if path_in_env:
        return path_in_env
        
    # 2. Check the user's custom D:\\ APP path
    d_path = r"D:\APP\Tesseract\tesseract.exe"
    if os.path.exists(d_path):
        return d_path
        
    # 3. Check other common candidates
    for path in _TESSERACT_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def _tesseract_available() -> bool:
    return _find_tesseract() is not None


# ── Screen capture ──────────────────────────────────────────────────────────

def _capture_screen(region=None):
    """Capture screen via the unified backend (all monitors, DPI-aware).

    Delegates to tools_screenshot.capture_screen so multi-monitor,
    DPI scaling, and the shared capture path are handled in one place.
    """
    from .tools_screenshot import capture_screen
    return capture_screen(region=region)


# ── Image preprocessing pipeline ────────────────────────────────────────────

def _preprocess(img):
    """Run the OCR preprocessing pipeline. Returns a PIL Image (L mode)."""
    from PIL import ImageFilter, ImageEnhance
    import numpy as np

    # Grayscale
    gray = img.convert("L")
    arr = np.array(gray)

    # Contrast enhancement (CLAHE-like stretch to full range)
    arr = np.clip(arr.astype(np.int16) * 1.6, 0, 255).astype(np.uint8)

    # Try OpenCV adaptive threshold
    try:
        import cv2
        blurred = cv2.GaussianBlur(arr, (3, 3), 0)
        adaptive = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 41, 10,
        )
        # Sharpen + denoise on the thresholded image
        kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
        sharpened = cv2.filter2D(adaptive, -1, kernel)
        denoised = cv2.medianBlur(sharpened, 3)
        return Image.fromarray(denoised)
    except ImportError:
        pass

    # PIL-only fallback
    gray = Image.fromarray(arr)
    gray = ImageEnhance.Contrast(gray).enhance(1.6)
    gray = gray.filter(ImageFilter.UnsharpMask(radius=2, percent=130, threshold=3))
    gray = gray.filter(ImageFilter.MedianFilter(size=3))
    return gray


# ── OCR with bounding boxes ─────────────────────────────────────────────────

def _ocr_with_boxes(img, lang: str = "eng") -> List[Dict[str, Any]]:
    """Run Tesseract, return word-level results with bounding boxes + confidence.

    Tuned for UI text: --psm 6 (single uniform block) + --oem 3 (LSTM only,
    most accurate) + an alphanumeric/punctuation char whitelist to suppress
    garbage characters on UI noise.  The whitelist is only applied for English
    so it never mangles Bangla/Hindi glyphs.
    """
    tesseract_path = _find_tesseract()
    if tesseract_path is None:
        raise ToolError(
            "Tesseract OCR is not installed. The user needs to install it:\n"
            "1. Download from https://github.com/UB-Mannheim/tesseract/wiki\n"
            "2. Install to C:\\Program Files\\Tesseract-OCR\\\n"
            "Until then, OCR-based clicking (clickOnText) will not work."
        )

    import pytesseract

    pytesseract.pytesseract.tesseract_cmd = tesseract_path

    # Map UI lang code → Tesseract lang code
    tess_lang = {"english": "eng", "bangla": "ben", "hindi": "hin", "auto": "eng+ben+hin"}.get(
        lang.lower(), "eng"
    )

    try:
        processed = _preprocess(img)
    except Exception:
        processed = img

    # Build a Tesseract config string.  psm 6 = single uniform block (good for
    # UI regions), oem 3 = LSTM engine (most accurate).  The char whitelist
    # suppresses garbage on UI noise but is ONLY safe for ASCII English; for
    # multi-language runs we skip it so Bangla/Hindi glyphs aren't stripped.
    is_english_only = tess_lang in ("eng", "english")
    whitelist = (
        'tessedit_char_whitelist='
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
        '0123456789'
        ' .,:;/\\()[]{}@#$%&*+-=<>"\'!?_'
        if is_english_only else ""
    )
    tess_config = f"--psm 6 --oem 3 -c {whitelist}" if whitelist else "--psm 6 --oem 3"

    try:
        data = pytesseract.image_to_data(
            processed, lang=tess_lang, config=tess_config, output_type=pytesseract.Output.DICT
        )
    except Exception as e:
        msg = str(e)
        # Language-load failures or whitelist rejection → retry with a minimal
        # config, progressively dropping options.
        for retry_config in ("--psm 6 --oem 3", "--psm 6", ""):
            try:
                data = pytesseract.image_to_data(
                    processed, lang=tess_lang, config=retry_config,
                    output_type=pytesseract.Output.DICT,
                )
                break
            except Exception:
                continue
        else:
            # All retries failed (corrupt/missing traineddata, etc.).
            # Raise ToolError so _ocr_best can fall through to EasyOCR.
            raise ToolError(f"OCR failed: {msg}") from e

    results: List[Dict[str, Any]] = []
    for i in range(len(data["text"])):
        text = data["text"][i].strip()
        conf = int(data["conf"][i])
        if text and conf > 25:
            results.append({
                "text": text,
                "left": int(data["left"][i]),
                "top": int(data["top"][i]),
                "width": int(data["width"][i]),
                "height": int(data["height"][i]),
                "conf": conf,
            })
    return results


# ── EasyOCR fallback tier ─────────────────────────────────────────────────

def _easyocr_available() -> bool:
    try:
        import easyocr  # noqa: F401
        return True
    except ImportError:
        return False


_easyocr_reader_cache = None


def _get_easyocr_reader():
    global _easyocr_reader_cache
    if _easyocr_reader_cache is not None:
        return _easyocr_reader_cache
    try:
        import easyocr
        _easyocr_reader_cache = easyocr.Reader(
            ["en", "bn", "hi"],
            gpu=True,
            verbose=False,
            quantized=True,
        )
        return _easyocr_reader_cache
    except Exception:
        return None


def _ocr_easyocr(img, lang: str = "eng") -> List[Dict[str, Any]]:
    reader = _get_easyocr_reader()
    if reader is None:
        return []

    lang_map = {
        "english": ["en"], "bangla": ["bn", "en"],
        "hindi": ["hi", "en"], "auto": ["en", "bn", "hi"],
    }
    langs = lang_map.get(lang.lower(), ["en"])

    try:
        import numpy as np
        arr = np.array(img)
        raw_results = reader.readtext(arr, detail=1, paragraph=False)
    except Exception:
        return []

    results: List[Dict[str, Any]] = []
    for (bbox, text, conf) in raw_results:
        text = text.strip()
        if not text or conf < 0.3:
            continue
        xs = [p[0] for p in bbox]
        ys = [p[1] for p in bbox]
        left, top = int(min(xs)), int(min(ys))
        right, bottom = int(max(xs)), int(max(ys))
        results.append({
            "text": text,
            "left": left,
            "top": top,
            "width": right - left,
            "height": bottom - top,
            "conf": int(conf * 100),
        })
    return results


# ── Hybrid OCR cascade ───────────────────────────────────────────────────

def _ocr_best(img, lang: str = "eng", min_results: int = 3) -> List[Dict[str, Any]]:
    """Hybrid OCR cascade: Tesseract (primary) + EasyOCR (fallback), cached."""
    tess_results: List[Dict[str, Any]] = []
    try:
        tess_results = _ocr_cached(img, lang, _ocr_with_boxes)
    except ToolError:
        pass

    if len(tess_results) >= min_results:
        return tess_results

    easy_results = _ocr_cached(img, lang, _ocr_easyocr)
    if not easy_results:
        return tess_results

    merged = list(tess_results)
    for er in easy_results:
        overlap = False
        for mr in merged:
            cx_e = er["left"] + er["width"] / 2
            cy_e = er["top"] + er["height"] / 2
            cx_m = mr["left"] + mr["width"] / 2
            cy_m = mr["top"] + mr["height"] / 2
            if abs(cx_e - cx_m) < 30 and abs(cy_e - cy_m) < 20:
                overlap = True
                if er["conf"] > mr["conf"]:
                    merged.remove(mr)
                    merged.append(er)
                break
        if not overlap:
            merged.append(er)

    return merged


# ── Fuzzy text matching ─────────────────────────────────────────────────────

def _normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9\u0980-\u09FF]", "", s.lower())


def _fuzzy_score(a: str, b: str) -> float:
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return 0.0
    try:
        from rapidfuzz import fuzz
        return max(
            fuzz.ratio(na, nb) / 100.0,
            fuzz.partial_ratio(na, nb) / 100.0,
        )
    except ImportError:
        import difflib
        return max(
            difflib.SequenceMatcher(None, na, nb).ratio(),
            difflib.SequenceMatcher(None, na, nb).get_matching_blocks() and
            min(len(na), len(nb)) / max(len(na), len(nb), 1) * (difflib.SequenceMatcher(None, na, nb).ratio()),
        )


def _find_best_match(words: List[Dict[str, Any]], target: str, threshold: float = 0.8) -> Optional[Tuple[Dict[str, Any], float]]:
    norm_target = _normalize(target)
    if not norm_target:
        return None

    best: Optional[Tuple[Dict[str, Any], float]] = None

    # 1. Multi-word phrases
    for i in range(len(words)):
        for span in range(2, 6):
            if i + span > len(words):
                break
            phrase_words = [words[j] for j in range(i, i + span)]
            phrase_text = " ".join(w["text"] for w in phrase_words)
            fuzzy = _fuzzy_score(phrase_text, target)
            xs = [w["left"] for w in phrase_words]
            if max(xs) - min(xs) > 1500:  # not on the same line
                continue
            # Weighted: 0.7 × max OCR confidence + 0.3 × fuzzy match score
            ocr_conf = max(w["conf"] for w in phrase_words) / 100.0
            score = 0.7 * ocr_conf + 0.3 * fuzzy
            if score >= threshold and (best is None or score > best[1]):
                xs2 = [w["left"] for w in phrase_words]
                ys2 = [w["top"] for w in phrase_words]
                xe = [w["left"] + w["width"] for w in phrase_words]
                ye = [w["top"] + w["height"] for w in phrase_words]
                merged = {
                    "text": phrase_text,
                    "left": min(xs2),
                    "top": min(ys2),
                    "width": max(xe) - min(xs2),
                    "height": max(ye) - min(ys2),
                    "conf": int(ocr_conf * 100),
                }
                best = (merged, score)
        # 2. Single word
        fuzzy = _fuzzy_score(words[i]["text"], target)
        ocr_conf = words[i]["conf"] / 100.0
        score = 0.7 * ocr_conf + 0.3 * fuzzy
        if score >= threshold and (best is None or score > best[1]):
            best = (dict(words[i]), score)

    return best


# ── Coordinates Mapping with DPI scaling support ────────────────────────────

def _map_screenshot_to_screen(x: float, y: float, shot_w: int, shot_h: int) -> Tuple[int, int]:
    """Map visual pixels on the captured screenshot to real coordinates."""
    try:
        from .tools_input import _get_virtual_screen
        screen_w, screen_h = _get_virtual_screen()
        if screen_w <= 0 or screen_h <= 0:
            import pyautogui
            screen_w, screen_h = pyautogui.size()
            
        scale_x = screen_w / shot_w
        scale_y = screen_h / shot_h
        return int(x * scale_x), int(y * scale_y)
    except Exception:
        return int(x), int(y)


# ── Visual Debugging Image Generation ───────────────────────────────────────

def _save_debug_image(img, boxes: List[Dict[str, Any]], match_box: Optional[Dict[str, Any]] = None) -> str:
    """Draw bounding boxes and highlight matched items for debugging visual search."""
    try:
        from PIL import ImageDraw
        draw_img = img.copy()
        draw = ImageDraw.Draw(draw_img)
        
        # Draw all boxes in light blue
        for b in boxes:
            l, t, w, h = b.get("left", 0), b.get("top", 0), b.get("width", 0), b.get("height", 0)
            draw.rectangle([l, t, l + w, t + h], outline="#38bdf8", width=2)
            
        # Draw chosen match in bright red
        if match_box:
            l, t, w, h = match_box.get("left", 0), match_box.get("top", 0), match_box.get("width", 0), match_box.get("height", 0)
            draw.rectangle([l, t, l + w, t + h], outline="#ef4444", width=4)
            
        debug_path = os.path.join(os.getcwd(), "debug_screenshot.jpg")
        draw_img.save(debug_path, "JPEG", quality=85)
        return debug_path
    except Exception:
        return ""


# ── Visual Verification ─────────────────────────────────────────────────────

def _verify_element_visually(img, box: Dict[str, Any], target: str, lang: str = "auto") -> bool:
    """Crop matched element and verify that the expected text is actually there."""
    try:
        pad = 12
        left = max(0, box["left"] - pad)
        top = max(0, box["top"] - pad)
        right = min(img.size[0], box["left"] + box["width"] + pad)
        bottom = min(img.size[1], box["top"] + box["height"] + pad)
        
        crop = img.crop((left, top, right, bottom))
        
        words = []
        try:
            words = _ocr_best(crop, lang=lang)
        except Exception:
            if _easyocr_available():
                words = _ocr_easyocr(crop, lang=lang)
                
        if not words:
            return True # skip if no words but template or icon was matched
            
        text = " ".join(w["text"] for w in words)
        score = _fuzzy_score(text, target)
        return score >= 0.75
    except Exception:
        return True


# ── OpenCV Template Matching ───────────────────────────────────────────────

def _template_match(img, target: str, threshold: float = 0.8) -> Optional[Tuple[int, int, int, int, float]]:
    """Use OpenCV matchTemplate to find visual icons or button images on screen."""
    try:
        import cv2
        import numpy as np
        
        template_path = None
        if os.path.exists(target):
            template_path = target
        else:
            # Check common directories
            possible_dirs = [
                os.path.join(os.getcwd(), "templates"),
                os.path.join(os.getcwd(), "assets"),
                os.getcwd()
            ]
            for d in possible_dirs:
                for ext in (".png", ".jpg", ".jpeg"):
                    p = os.path.join(d, f"{target}{ext}")
                    if os.path.exists(p):
                        template_path = p
                        break
                if template_path:
                    break
                    
        if not template_path:
            return None
            
        screen_arr = np.array(img.convert("L"))
        template_img = cv2.imread(template_path, cv2.IMREAD_GRAYSCALE)
        if template_img is None:
            return None
            
        th, tw = template_img.shape[:2]
        if tw > screen_arr.shape[1] or th > screen_arr.shape[0]:
            return None
            
        res = cv2.matchTemplate(screen_arr, template_img, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)
        
        if max_val >= threshold:
            left, top = max_loc
            return left, top, tw, th, float(max_val)
    except Exception:
        pass
    return None


# ── UI Automation (Windows Accessibility) ───────────────────────────────────

def _find_element_uia(target: str, threshold: float = 0.8) -> Optional[Dict[str, Any]]:
    """Windows Accessibility walker — delegates to tools_uia for the actual walk.

    Kept for backward compatibility: every existing caller (clickOnText,
    _find_element_visual, short-text pre-check) still imports this name.
    The real search logic now lives in tools_uia.find_uia_element so a single
    implementation is shared across the agent.
    """
    try:
        from .tools_uia import find_uia_element as _find
        el = _find({"text": target}, search_depth=6, threshold=threshold)
        if el:
            # Strip the live control handle — visual-tier callers only need x/y.
            return {k: v for k, v in el.items() if k != "control"}
        return None
    except Exception:
        return None


# Legacy BFS walker — retained for callers that need raw controls. The real
# search now goes through tools_uia.find_uia_element above.
def _walk_uia(ctrl, max_depth=8):
    from collections import deque
    queue = deque([(ctrl, 0)])
    while queue:
        c, d = queue.popleft()
        yield c, d
        if d < max_depth:
            try:
                children = c.GetChildren() or []
                for ch in children:
                    queue.append((ch, d + 1))
            except Exception:
                continue


# ── Playwright Browser Action Dispatch ──────────────────────────────────────

def _try_playwright_action(action: str, target: str, args: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Try executing high-fidelity browser actions via Playwright first."""
    from .registry import STATE
    if STATE.page is None:
        return None

    from .tools_browser import _run

    async def _async_task():
        try:
            page = STATE.page
            is_closed = False
            try:
                is_closed = page.is_closed()
            except Exception:
                try:
                    is_closed = page.is_closed
                except Exception:
                    pass
            if is_closed:
                return None

            if action == "find":
                selectors = [
                    lambda p: p.get_by_text(str(target), exact=False).first,
                    lambda p: p.get_by_role("button", name=str(target), exact=False).first,
                    lambda p: p.get_by_role("link", name=str(target), exact=False).first,
                    lambda p: p.locator(f"text='{target}'").first,
                ]
                for sel in selectors:
                    try:
                        loc = sel(page)
                        if loc and await loc.count() > 0:
                            box = await loc.bounding_box()
                            if box:
                                return {
                                    "x": int(box["x"] + box["width"] / 2),
                                    "y": int(box["y"] + box["height"] / 2),
                                    "box": {"left": int(box["x"]), "top": int(box["y"]), "width": int(box["width"]), "height": int(box["height"])},
                                    "confidence": 1.0,
                                    "method": "playwright",
                                    "matched_text": target
                                }
                    except Exception:
                        continue

            elif action == "click":
                selectors = [
                    lambda p: p.get_by_text(str(target), exact=False).first,
                    lambda p: p.get_by_role("button", name=str(target), exact=False).first,
                    lambda p: p.get_by_role("link", name=str(target), exact=False).first,
                    lambda p: p.locator(f"text='{target}'").first,
                ]
                for sel in selectors:
                    try:
                        loc = sel(page)
                        if loc and await loc.count() > 0:
                            box = await loc.bounding_box()
                            await loc.click(timeout=3000)
                            cx = int(box["x"] + box["width"] / 2) if box else 0
                            cy = int(box["y"] + box["height"] / 2) if box else 0
                            return {
                                "result": f"Successfully clicked '{target}' via Playwright.",
                                "x": cx,
                                "y": cy,
                                "confidence": 1.0,
                                "method": "playwright",
                                "matched_text": target
                            }
                    except Exception:
                        continue
        except Exception:
            pass
        return None

    try:
        return _run(_async_task())
    except Exception:
        return None


# ── Unified Core Finder ─────────────────────────────────────────────────────

def _find_element_visual(target: str, lang: str = "auto", threshold: float = 0.8) -> Optional[Dict[str, Any]]:
    """Core interaction visual engine — 6-tier cascade.

    Tier 0: Playwright (if browser tab active)
    Tier 1: UI Automation (Windows Accessibility — gold standard)
    Tier 2: OCR (Tesseract + EasyOCR hybrid)
    Tier 3: Template matching (OpenCV)
    Tier 4: Heuristic — match window title / child text via win32gui
    Tier 5: Gemini Vision (optional placeholder — not wired here)

    Region-based: tries foreground window first, then expands 20% if the best
    OCR match confidence < 0.6 before falling through to the full screen.
    """
    target = target.strip()
    if not target:
        return None

    # ── Tier 0: Playwright (browser DOM) ─────────────────────────────────────
    pw = _try_playwright_action("find", target, {})
    if pw:
        return pw

    # ── Tier 1: UI Automation (Accessibility tree) ────────────────────────────
    uia = _find_element_uia(target, threshold=threshold)
    if uia:
        return uia

    # ── Tiers 2 & 3: Region-based OCR + Template matching ─────────────────────
    regions = _build_ocr_regions()

    for _region_idx, region in enumerate(regions):
        img = _capture_screen(region=region)
        shot_w, shot_h = img.size

        # Tier 3: OpenCV Template Match
        tmpl = _template_match(img, target, threshold=threshold)
        if tmpl:
            left, top, w, h, conf = tmpl
            cx_img = left + w // 2
            cy_img = top + h // 2
            cx, cy = _map_screenshot_to_screen(cx_img, cy_img, shot_w, shot_h)
            box = {"left": left, "top": top, "width": w, "height": h}
            _save_debug_image(img, [box], box)
            return {
                "x": cx,
                "y": cy,
                "box": box,
                "confidence": conf,
                "method": "template_matching",
                "matched_text": target
            }

        # Tier 2: OCR Hybrid
        words = []
        try:
            words = _ocr_best(img, lang=lang)
        except ToolError:
            if _easyocr_available():
                words = _ocr_cached(img, lang, _ocr_easyocr)

        match_info = _find_best_match(words, target, threshold=threshold)
        if match_info:
            match, score = match_info
            if score >= threshold:
                if _verify_element_visually(img, match, target, lang):
                    cx_img = match["left"] + match["width"] // 2
                    cy_img = match["top"] + match["height"] // 2
                    cx, cy = _map_screenshot_to_screen(cx_img, cy_img, shot_w, shot_h)

                    # Visual debug screenshot save
                    _save_debug_image(img, words, match)

                    return {
                        "x": cx,
                        "y": cy,
                        "box": {
                            "left": match["left"],
                            "top": match["top"],
                            "width": match["width"],
                            "height": match["height"]
                        },
                        "confidence": score,
                        "method": "ocr",
                        "matched_text": match["text"]
                    }

            # Low confidence (< 0.6) → continue to next (enlarged) region
            # instead of giving up immediately.
            if match_info and match_info[1] < 0.6:
                continue

    # ── Tier 4: Heuristic — win32gui window/child text match ──────────────────
    heur = _heuristic_window_find(target)
    if heur:
        return heur

    # ── Tier 5: Gemini Vision (placeholder) ────────────────────────────────────
    # Reserved for a future tools_vision_ai module.  Disabled by default; when
    # wired, it should run last because each call costs an API round-trip.
    # gemini = _gemini_vision_find(target)
    # if gemini: return gemini

    return None


def _heuristic_window_find(target: str) -> Optional[Dict[str, Any]]:
    """Tier-4 heuristic: locate a window or child by title text via win32gui.

    Walks visible top-level windows and returns the center of the first whose
    title contains *target*.  This catches cases where a target lives in a
    separate window that the foreground-focused UIA/OCR pass wouldn't see.
    """
    try:
        import ctypes
        needle = target.lower()
        found = []

        def _cb(hwnd, _):
            try:
                if not ctypes.windll.user32.IsWindowVisible(hwnd):
                    return True
                length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
                if length <= 0:
                    return True
                buf = ctypes.create_unicode_buffer(length + 1)
                ctypes.windll.user32.GetWindowTextW(hwnd, buf, length + 1)
                title = buf.value
                if title and needle in title.lower():
                    rect = ctypes.wintypes.RECT()  # type: ignore[attr-defined]
                    ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))
                    if rect.right > rect.left and rect.bottom > rect.top:
                        found.append({
                            "x": (rect.left + rect.right) // 2,
                            "y": (rect.top + rect.bottom) // 2,
                            "box": {
                                "left": rect.left, "top": rect.top,
                                "width": rect.right - rect.left,
                                "height": rect.bottom - rect.top,
                            },
                            "confidence": 0.7,
                            "method": "heuristic_window",
                            "matched_text": title,
                        })
            except Exception:
                pass
            return True

        ctypes.windll.user32.EnumWindows(_cb, None)
        return found[0] if found else None
    except Exception:
        return None


# ── Region helpers ─────────────────────────────────────────────────────────────

def _get_foreground_rect() -> Optional[Tuple[int, int, int, int]]:
    """Return (left, top, right, bottom) of the foreground window, or None."""
    try:
        import ctypes
        _user32 = ctypes.windll.user32
        hwnd = _user32.GetForegroundWindow()
        if not hwnd:
            return None
        rect = ctypes.wintypes.RECT()  # type: ignore[attr-defined]
        ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))
        return (rect.left, rect.top, rect.right, rect.bottom)
    except Exception:
        return None


def _enlarge_rect(rect: Tuple[int, int, int, int], pct: float = 0.20) -> Tuple[int, int, int, int]:
    """Expand a bounding box by *pct* on each side, clamped to 0."""
    l, t, r, b = rect
    w = r - l
    h = b - t
    dx = int(w * pct)
    dy = int(h * pct)
    return (max(0, l - dx), max(0, t - dy), r + dx, b + dy)


def _build_ocr_regions() -> List[Optional[Tuple[int, int, int, int]]]:
    """Return a list of capture regions to try, from smallest to largest.

    Strategy:
      1. Foreground window only  (fastest, least noise)
      2. Foreground window +20% (catches items just outside the border)
      3. Full screen (None → capture_screen defaults)
    """
    regions: List[Optional[Tuple[int, int, int, int]]] = []
    fg = _get_foreground_rect()
    if fg:
        regions.append(fg)
        regions.append(_enlarge_rect(fg, 0.20))
    regions.append(None)  # full screen fallback
    return regions


def _scroll_screen(direction: str = "down", amount: int = 5):
    """Auxiliary scrolling helper. Invalidates capture cache after scrolling."""
    try:
        from .tools_input import _win32_scroll, _win32_hscroll
        if direction in ("left", "right"):
            _win32_hscroll(amount, direction)
        else:
            _win32_scroll(amount, direction)
        time.sleep(0.4)
    except Exception:
        pass

    # The screen just changed — invalidate cached frames so the next OCR
    # pass picks up the new content instead of re-using a stale image.
    try:
        from .tools_screenshot import _invalidate_capture_cache
        _invalidate_capture_cache()
    except Exception:
        pass


# ── Registered tools ────────────────────────────────────────────────────────

@register("screenResolution")
def screen_resolution(args: Dict[str, Any]) -> Dict[str, Any]:
    """Return the virtual-screen size in physical pixels."""
    try:
        import pyautogui
        w, h = pyautogui.size()
    except Exception as e:
        raise ToolError(f"Could not read screen size: {e}") from e
    scaling = 1.0
    try:
        import ctypes
        hdc = ctypes.windll.user32.GetDC(0)
        LOGPIXELSX = 88
        dpi = ctypes.windll.gdi32.GetDeviceCaps(hdc, LOGPIXELSX)
        ctypes.windll.user32.ReleaseDC(0, hdc)
        scaling = round(dpi / 96.0, 2)
    except Exception:
        pass
    return {"result": f"Screen is {w}x{h} physical pixels (scaling {scaling:.0%}).", "width": w, "height": h, "scaling": scaling}


@register("clickOnText")
def click_on_text(args: Dict[str, Any]) -> Dict[str, Any]:
    """Redesigned Smart Click engine prioritizing UIA & Playwright, fallback OCR."""
    target = args.get("text") or args.get("target") or args.get("label")
    button = str(args.get("button", "left")).lower()
    double = bool(args.get("double", False))
    lang = str(args.get("lang", "auto"))
    direction = str(args.get("direction", "down")).lower()
    max_scrolls = int(args.get("max_scrolls", 5))

    if not target:
        raise ToolError("Parameter 'text' (target label to click) is required.")

    # ── UIA-first click for the foreground window ──────────────────────────────
    # UIA is far more accurate than OCR for standard Windows controls
    # (menus, buttons, list items).  Try it before anything else.
    try:
        from .tools_uia import click_on_uia, _uia_available
        if _uia_available():
            control_type = args.get("control_type") or args.get("controlType")
            # Try exact match first (most reliable), then fuzzy/partial.
            for exact in (True, False):
                el = click_on_uia(str(target), control_type=control_type,
                                  exact=exact, double=double, verify=True)
                if el:
                    return {
                        "result": f"Clicked '{el['matched_text']}' at "
                                  f"({el['x']},{el['y']}) via UI Automation (exact={exact}).",
                        "x": el["x"],
                        "y": el["y"],
                        "method": "uiautomation",
                        "confidence": el["confidence"],
                        "control_type": el.get("control_type", ""),
                    }
    except Exception:
        pass  # fall through to the visual cascade

    # Pre-check: for very short text (≤3 chars), try UIA Name/keyboard
    # shortcut matching first — OCR is unreliable on single letters/keys.
    if len(target.strip()) <= 3:
        uia_short = _find_element_uia(target, threshold=0.6)
        if uia_short:
            el = uia_short
            cx, cy = el["x"], el["y"]
            from .tools_input import _smooth_move, _win32_click, _win32_double_click, _win32_get_pos
            _smooth_move(cx, cy, duration=0.2)
            time.sleep(0.08)
            if double:
                _win32_double_click(button, cx, cy)
            else:
                _win32_click(button, cx, cy)
            return {
                "result": f"Clicked '{el['matched_text']}' at ({cx},{cy}) via {el['method']} (short-text UIA).",
                "x": cx,
                "y": cy,
                "method": el["method"],
                "confidence": el["confidence"]
            }

    for scroll_idx in range(max_scrolls + 1):
        el = _find_element_visual(target, lang=lang)
        if el:
            if el["confidence"] < 0.8:
                raise ToolError(f"Found '{target}' but confidence {el['confidence']:.2f} is below 0.8 threshold.")

            cx, cy = el["x"], el["y"]

            if el["method"] == "playwright":
                # Playwright has already clicked
                return {
                    "result": f"Clicked '{target}' inside active browser tab via Playwright.",
                    "x": cx,
                    "y": cy,
                    "method": "playwright",
                    "confidence": el["confidence"]
                }

            # Move and perform precise hardware click with retry validation
            from .tools_input import _smooth_move, _win32_click, _win32_double_click, _win32_get_pos
            
            clicked_successfully = False
            for attempt in range(3):
                _smooth_move(cx, cy, duration=0.2)
                time.sleep(0.08)
                if double:
                    _win32_double_click(button, cx, cy)
                else:
                    _win32_click(button, cx, cy)
                
                time.sleep(0.08)
                ax, ay = _win32_get_pos()
                if abs(ax - cx) <= 15 and abs(ay - cy) <= 15:
                    clicked_successfully = True
                    break
                else:
                    time.sleep(0.15)

            if clicked_successfully:
                return {
                    "result": f"Clicked '{el['matched_text']}' at ({cx},{cy}) via {el['method']}.",
                    "x": cx,
                    "y": cy,
                    "method": el["method"],
                    "confidence": el["confidence"]
                }
            else:
                raise ToolError(f"Click on '{target}' at ({cx},{cy}) failed pointer registration checks.")

        if scroll_idx < max_scrolls:
            _scroll_screen(direction)
        else:
            raise ToolError(f"Could not find '{target}' with confidence >= 0.8 even after {max_scrolls} scrolls.")


@register("findOnScreen")
def find_on_screen(args: Dict[str, Any]) -> Dict[str, Any]:
    """Find where a visible text/label is on screen WITHOUT clicking."""
    target = args.get("text") or args.get("target") or args.get("label")
    lang = str(args.get("lang", "auto"))
    if not target:
        raise ToolError("Parameter 'text' is required.")

    el = _find_element_visual(target, lang=lang)
    if el:
        return {
            "result": f"Found '{el['matched_text']}' (score {el['confidence']:.0%}) at ({el['x']},{el['y']}) via {el['method']}.",
            "found": True,
            "x": el["x"],
            "y": el["y"],
            "matched_text": el["matched_text"],
            "confidence": el["confidence"],
            "method": el["method"],
            "box": el["box"]
        }
    return {"result": f"'{target}' not found on screen.", "found": False}


@register("ocrStatus")
def ocr_status(args: Dict[str, Any]) -> Dict[str, Any]:
    """Report which OCR engines are installed (Tesseract, EasyOCR, OpenCV)."""
    tess_path = _find_tesseract()
    easy = _easyocr_available()
    try:
        import cv2
        cv2_ok = True
    except ImportError:
        cv2_ok = False

    engines = []
    if tess_path:
        engines.append(f"Tesseract ({tess_path})")
    if easy:
        engines.append("EasyOCR (PyTorch)")
    if cv2_ok:
        engines.append("OpenCV")

    return {
        "result": f"OCR engines available: {', '.join(engines)}." if engines else "No OCR engines installed.",
        "installed": bool(engines),
        "engines": {"tesseract": bool(tess_path), "easyocr": easy, "opencv": cv2_ok},
        "tesseract_path": tess_path,
    }


__all__ = ["screen_resolution", "click_on_text", "find_on_screen", "ocr_status"]
