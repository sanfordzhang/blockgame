#!/usr/bin/env python3
"""
Mouse operation recorder v7 - Triple-channel (Quartz + pynput + cliclick).
- Channel 1 (PRIMARY): Quartz CGEventTap for scroll + mouse buttons + move
  - Pixel-accurate scroll, instant click detection, real-time logging
- Channel 2 (BACKUP):  pynput mouse listener for REAL button press/release
  - Catches clicks that Quartz misses (NO heuristic guessing!)
- Channel 3 (FALLBACK): cliclick polling for position ONLY (no click guess)
- Generates SINGLE Python replay script (pixel-unit scroll)
Stops after 10s of inactivity.
"""

import json
import time
import os
import subprocess
import threading
from datetime import datetime
from collections import deque

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "mouse-operations.json")

recorded_actions = []
last_activity_time = time.time()
is_recording = True
INACTIVITY_TIMEOUT = 10.0
POLL_INTERVAL = 0.03  # 30ms polling
action_id = 0
start_time = time.time()

# Event queues from background threads (thread-safe)
event_queue = deque()
event_lock = threading.Lock()

# Click dedup: avoid recording same-position clicks within this window
CLICK_DEDUP_WINDOW = 0.5  # seconds
last_click_time = {}  # {"click": (time, x, y), "right_click": (time, x, y)}


def record_action(atype, x, y, **extra):
    global action_id, last_activity_time
    now = time.time()
    last_activity_time = now

    # Click dedup: skip if same type+position within window
    if atype in ("click", "right_click"):
        prev = last_click_time.get(atype)
        if prev:
            pt, px, py = prev
            if (now - pt < CLICK_DEDUP_WINDOW and
                    abs(px - int(x)) < 5 and abs(py - int(y)) < 5):
                return  # skip duplicate
        last_click_time[atype] = (now, int(x), int(y))

    action_id += 1

    action = {
        "id": action_id,
        "type": atype,
        "x": int(x),
        "y": int(y),
        "elapsed_s": round(now - start_time, 3),
        "time_str": datetime.now().strftime("%H:%M:%S.%f")[:-3],
        **extra
    }

    # Deduplicate tiny moves (<3px within 80ms of last move)
    if atype == "move" and recorded_actions:
        last = recorded_actions[-1]
        if (last["type"] == "move" and
            abs(last["x"] - action["x"]) < 3 and
            abs(last["y"] - action["y"]) < 3 and
            now - start_time - last["elapsed_s"] < 0.08):
            return

    recorded_actions.append(action)

    icons = {
        "move": "->", "click": "[CLICK]", "right_click": "[RIGHT]",
        "scroll_up": "^SCROLL^", "scroll_down": "vSCROLLv",
        "scroll_left": "<SCROLL<", "scroll_right": ">SCROLL>"
    }
    icon = icons.get(atype, "?")
    detail = ""
    if "dx" in extra or "dy" in extra:
        detail = f" d=({extra.get('dx',0):+d},{extra.get('dy',0):+d})"
    if "px_dx" in extra or "px_dy" in extra:
        detail += f" px=({extra.get('px_dx',0):+d},{extra.get('px_dy',0):+d})"
    src = extra.get("src", "")
    print(f"  [{action_id:>3}] {icon} ({int(x):>4},{int(y):>4}){detail}{src} t={action['elapsed_s']:>7.2f}s",
          flush=True)


# === Screenshot ===
subprocess.run(
    ["screencapture", "-x", os.path.join(SCRIPT_DIR, "screenshots", "record-start.png")],
    capture_output=True
)

print("=" * 60)
print("  MOUSE RECORDER v7 (Quartz + pynput + cliclick)")
print("=" * 60)
print(f"  Ch1 Quartz:   scroll + click + move")
print(f"  Ch2 pynput:   real button events (backup)")
print(f"  Ch3 cliclick: position only (fallback)")
print(f"  Screenshot:   screenshots/record-start.png")
print(f"  Output:       {OUTPUT_FILE}")
print(f"  Timeout:      {INACTIVITY_TIMEOUT}s inactivity")
print("-" * 60)
print("  >>> START OPERATING NOW! <<<")
print("-" * 60)

# Background threads
def check_inactivity():
    global is_recording
    while is_recording:
        if time.time() - last_activity_time >= INACTIVITY_TIMEOUT:
            is_recording = False
            print(f"\n{'='*55}")
            print(f"  STOPPED: {INACTIVITY_TIMEOUT}s no activity")
            print(f"{'='*55}\n", flush=True)
            return
        time.sleep(0.10)

threading.Thread(target=check_inactivity, daemon=True).start()


# ============================================================
# Channel 1: Quartz Event Listener (scroll + buttons + move)
# ============================================================
quartz_running = False

def quartz_event_listener():
    """Listen for scroll, mouse button, and mouse move events via Quartz."""
    global quartz_running
    quartz_running = True

    try:
        from Quartz import (
            CGEventTapCreate, CGEventTapEnable,
            kCGSessionEventTap, kCGHeadInsertEventTap,
            kCGEventTapOptionListenOnly, kCFRunLoopDefaultMode,
            CGEventGetLocation, CGEventGetType,
            CGEventGetIntegerValueField,
            kCGScrollWheelEventDeltaAxis1, kCGScrollWheelEventDeltaAxis2,
            kCGScrollWheelEventPointDeltaAxis1, kCGScrollWheelEventPointDeltaAxis2,
            kCGEventLeftMouseDown, kCGEventLeftMouseUp,
            kCGEventRightMouseDown, kCGEventRightMouseUp,
            kCGEventMouseMoved,
            kCGMouseButtonName,
            CFMachPortCreateRunLoopSource, CFRunLoopAddSource,
            CFRunLoopGetCurrent, CFRunLoopRunInMode,
        )

        def event_callback(proxy, etype, event, refcon):
            event_type = CGEventGetType(event)
            loc = CGEventGetLocation(event)

            try:
                if event_type == kCGEventScrollWheel:
                    line_dy = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis1)
                    line_dx = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis2)
                    px_dy = CGEventGetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis1)
                    px_dx = CGEventGetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis2)

                    if line_dy != 0 or line_dx != 0 or px_dy != 0 or px_dx != 0:
                        with event_lock:
                            event_queue.append({
                                "type": "scroll",
                                "x": int(loc.x), "y": int(loc.y),
                                "line_dx": int(line_dx), "line_dy": int(line_dy),
                                "px_dx": int(px_dx), "px_dy": int(px_dy),
                                "time": time.time()
                            })

                elif event_type in (kCGEventLeftMouseDown, kCGEventLeftMouseUp):
                    is_down = (event_type == kCGEventLeftMouseDown)
                    with event_lock:
                        event_queue.append({
                            "type": "left_down" if is_down else "left_up",
                            "x": int(loc.x), "y": int(loc.y),
                            "time": time.time()
                        })

                elif event_type in (kCGEventRightMouseDown, kCGEventRightMouseUp):
                    is_down = (event_type == kCGEventRightMouseDown)
                    with event_lock:
                        event_queue.append({
                            "type": "right_down" if is_down else "right_up",
                            "x": int(loc.x), "y": int(loc.y),
                            "time": time.time()
                        })

                elif event_type == kCGEventMouseMoved:
                    with event_lock:
                        event_queue.append({
                            "type": "q_move",
                            "x": int(loc.x), "y": int(loc.y),
                            "time": time.time()
                        })
            except Exception:
                pass

            return event

        mask = (1 << kCGEventScrollWheel |
                1 << kCGEventLeftMouseDown | 1 << kCGEventLeftMouseUp |
                1 << kCGEventRightMouseDown | 1 << kCGEventRightMouseUp |
                1 << kCGEventMouseMoved)

        tap = CGEventTapCreate(
            kCGSessionEventTap, kCGHeadInsertEventTap,
            kCGEventTapOptionListenOnly,
            mask, event_callback, None
        )

        if not tap:
            print("  [Quartz] Tap failed (need Accessibility permission?)", flush=True)
            return

        source = CFMachPortCreateRunLoopSource(None, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopDefaultMode)
        CGEventTapEnable(tap, True)
        print("  [Quartz] ACTIVE: scroll+click+move", flush=True)

        while is_recording:
            CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.15, True)

    except ImportError as e:
        print(f"  [Quartz] ImportError: {e}", flush=True)
        import traceback; traceback.print_exc()
    except Exception as e:
        print(f"  [Quartz] Error: {type(e).__name__}: {e}", flush=True)
        import traceback; traceback.print_exc()

threading.Thread(target=quartz_event_listener, daemon=True).start()
time.sleep(0.3)


# ============================================================
# Channel 2: pynput Mouse Listener (REAL button events backup)
# ============================================================
pynput_running = False

def pynput_event_listener():
    """Use pynput to detect REAL mouse button presses (no guessing!)."""
    global pynput_running
    pynput_running = True

    try:
        from pynput import mouse

        def on_click(x, y, button, pressed):
            if not is_recording:
                return
            btn_type = "click" if button == mouse.Button.left else (
                         "right_click" if button == mouse.Button.right else None)
            if btn_type is None:
                return
            if pressed:
                # Record click immediately on press (not waiting for release)
                with event_lock:
                    event_queue.append({
                        "type": "pynput_" + btn_type,
                        "x": int(x), "y": int(y),
                        "button": str(button),
                        "pressed": True,
                        "time": time.time()
                    })

        def on_scroll(x, y, dx, dy):
            if not is_recording:
                return
            # pynput scroll is a bonus; Quartz handles it primarily
            with event_lock:
                event_queue.append({
                    "type": "pynput_scroll",
                    "x": int(x), "y": int(y),
                    "px_dx": int(dx), "px_dy": int(dy),
                    "time": time.time()
                })

        # Start listening non-blocking
        listener = mouse.Listener(on_click=on_click, on_scroll=on_scroll)
        listener.daemon = True
        listener.start()

        print("  [pynput] ACTIVE: real button detection", flush=True)

        # Keep thread alive while recording
        while is_recording and listener.is_alive():
            time.sleep(0.2)

        listener.stop()

    except ImportError as e:
        print(f"  [pynput] ImportError: {e}", flush=True)
    except Exception as e:
        print(f"  [pynput] Error: {type(e).__name__}: {e}", flush=True)
        import traceback; traceback.print_exc()

threading.Thread(target=pynput_event_listener, daemon=True).start()
time.sleep(0.2)


# ============================================================
# Main loop: Process all channel events
# ============================================================
prev_x, prev_y = -9999, -9999
# Track pending Quartz button down for paired click detection
pending_left_down = None
pending_right_down = None
# Track which channels produced data (for fallback logic)
quartz_got_events = False
pynput_got_events = False
last_scroll_time = 0
SCROLL_DEDUP_MS = 25

print("\nRecording...\n", flush=True)

try:
    while is_recording:
        now_t = time.time()

        # --- Drain all queued events from both channels ---
        with event_lock:
            pending = list(event_queue)
            event_queue.clear()

        got_quartz_this_cycle = False
        got_pynput_this_cycle = False

        for ev in pending:
            etype = ev["type"]
            ex, ey = ev["x"], ev["y"]

            # === Quartz events ===
            if etype == "scroll":
                got_quartz_this_cycle = True
                pdy = ev.get("px_dy", 0)
                pdx = ev.get("px_dx", 0)
                ldy = ev.get("line_dy", 0)
                ldx = ev.get("line_dx", 0)

                if now_t - last_scroll_time < SCROLL_DEDUP_MS / 1000.0:
                    continue
                last_scroll_time = now_t

                if abs(pdy) > 0 or abs(pdx) > 0:
                    stype = "scroll_down" if pdy < 0 else ("scroll_up" if pdy > 0 else
                              ("scroll_left" if pdx < 0 else "scroll_right"))
                    record_action(stype, ex, ey,
                                  dy=pdy, dx=pdx, line_dy=ldy, line_dx=ldx,
                                  src=" [Q]")

            elif etype == "left_down":
                got_quartz_this_cycle = True
                pending_left_down = (ex, ey)
                print(f"       [Q-BTN] LEFT_DOWN@({ex},{ey})", flush=True)

            elif etype == "left_up":
                got_quartz_this_cycle = True
                if pending_left_down is not None:
                    cx, cy = pending_left_down
                    record_action("click", cx, cy, src=" [Q]")
                    pending_left_down = None
                # else: orphan up, ignore (will be caught by pynput if needed)

            elif etype == "right_down":
                got_quartz_this_cycle = True
                pending_right_down = (ex, ey)
                print(f"       [Q-BTN] RIGHT_DOWN@({ex},{ey})", flush=True)

            elif etype == "right_up":
                got_quartz_this_cycle = True
                if pending_right_down is not None:
                    cx, cy = pending_right_down
                    record_action("right_click", cx, cy, src=" [Q]")
                    pending_right_down = None

            elif etype == "q_move":
                got_quartz_this_cycle = True
                if abs(ex - prev_x) + abs(ey - prev_y) > 3:
                    record_action("move", ex, ey, src=" [Q]")
                    prev_x, prev_y = ex, ey

            # === pynput events (backup) ===
            elif etype == "pynput_click":
                got_pynput_this_cycle = True
                record_action("click", ex, ey, src=" [P]")

            elif etype == "pynput_right_click":
                got_pynput_this_cycle = True
                record_action("right_click", ex, ey, src=" [P]")

            elif etype == "pynput_scroll":
                got_pynput_this_cycle = True
                # Only use pynput scroll if Quartz hasn't provided any recently
                if now_t - last_scroll_time > 0.1:  # 100ms since last scroll
                    pdy = ev.get("px_dy", 0)
                    pdx = ev.get("px_dx", 0)
                    stype = "scroll_down" if pdy < 0 else ("scroll_up" if pdy > 0 else
                              ("scroll_left" if pdx < 0 else "scroll_right"))
                    record_action(stype, ex, ey, dy=pdy, dx=pdx, src=" [P]")
                    last_scroll_time = now_t

        if got_quartz_this_cycle:
            quartz_got_events = True
        if got_pynput_this_cycle:
            pynput_got_events = True

        # --- Position tracking: ALWAYS run (independent of other channels!) ---
        # cliclick provides mouse position even when Quartz/pynput are active,
        # because Quartz q_move events may be lost or filtered out.
        # This ONLY records move, never guesses clicks.
        try:
            result = subprocess.run(
                ["cliclick", "p"], capture_output=True, text=True, timeout=0.6
            )
            parts = result.stdout.strip().split(",")
            if len(parts) >= 2:
                x, y = int(parts[0]), int(parts[1])
                if abs(x - prev_x) + abs(y - prev_y) > 3:
                    record_action("move", x, y, src=" [C]")
                    prev_x, prev_y = x, y
        except Exception:
            pass

        time.sleep(POLL_INTERVAL)

except KeyboardInterrupt:
    print("\n\nInterrupted.", flush=True)
finally:
    is_recording = False


# === Save results + generate unified Python replay script ===
if not recorded_actions:
    print("WARNING: No actions recorded!", flush=True)
else:
    simplified = []
    for a in recorded_actions:
        if a["type"] in ("click", "right_click"):
            simplified.append(a)
        elif a["type"] == "move":
            if not simplified or (
                abs(simplified[-1]["x"] - a["x"]) > 15 or
                abs(simplified[-1]["y"] - a["y"]) > 15
            ):
                simplified.append(a)
        elif a["type"].startswith("scroll"):
            simplified.append(a)

    channels_active = []
    if quartz_got_events:
        channels_active.append("Quartz")
    if pynput_got_events:
        channels_active.append("pynput")

    output = {
        "version": "v7-triple-channel",
        "recorded_at": datetime.now().isoformat(),
        "total_raw": len(recorded_actions),
        "simplified_count": len(simplified),
        "channels_used": channels_active,
        "actions": recorded_actions,
        "simplified": simplified,
        "scroll_supported": bool(any(
            a["type"].startswith("scroll") for a in recorded_actions))
    }

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    type_counts = {}
    for a in recorded_actions:
        t = a["type"]
        type_counts[t] = type_counts.get(t, 0) + 1

    print(f"\n{'='*55}")
    print(f"  RECORDING COMPLETE")
    print(f"{'='*55}")
    print(f"  Channels active:   {' + '.join(channels_active) if channels_active else 'NONE'}")
    print(f"  Raw actions:       {len(recorded_actions)}")
    print(f"  Simplified:        {len(simplified)}")
    print(f"  Scroll support:    {'YES' if output['scroll_supported'] else 'NO'}")
    for t, c in sorted(type_counts.items()):
        icons2 = {"move":"->","click":"[CLICK]","right_click":"[RIGHT]",
                  "scroll_up":"^UP^","scroll_down":"vDOWNv",
                  "scroll_left":"<LEFT<","scroll_right":">RIGHT>"}
        print(f"    {icons2.get(t,'?'):>10} {t}:  {c}")
    print(f"  Output:            {OUTPUT_FILE}")

    # === Generate unified Python replay script (PIXEL units) ===
    py_file = OUTPUT_FILE + ".replay.py"

    replay_actions = []
    for a in simplified:
        ra = {"type": a["type"], "x": a["x"], "y": a["y"],
              "elapsed": a.get("elapsed_s", 0)}
        if a["type"].startswith("scroll_"):
            ra["dy"] = a.get("dy", a.get("line_dy", 0))
            ra["dx"] = a.get("dx", a.get("line_dx", 0))
            ra["is_pixel"] = "dy" in a and a.get("dy", 0) != a.get("line_dy", 0)
        replay_actions.append(ra)

    lines = []
    lines.append('#!/usr/bin/env python3')
    lines.append('"""Auto-generated mouse+scroll replay (single-process Quartz).')
    lines.append(f'Recorded: {output["recorded_at"]}"""')
    lines.append('import sys, os, time, datetime')
    lines.append('')
    lines.append('try:')
    lines.append('    from Quartz import (')
    lines.append('        CGEventCreateMouseEvent, CGEventPost,')
    lines.append('        CGEventCreateScrollWheelEvent,')
    lines.append('        CGEventSetSource, CGEventSourceCreate,')
    lines.append('        kCGEventSourceStateHIDSystemState,')
    lines.append('        kCGHIDEventTap, kCGMouseButtonLeft, kCGMouseButtonRight,')
    lines.append('        kCGEventMouseMoved, kCGEventLeftMouseDown, kCGEventLeftMouseUp,')
    lines.append('        kCGEventRightMouseDown, kCGEventRightMouseUp,')
    lines.append('        kCGScrollEventUnitPixel,')
    lines.append('    )')
    lines.append('except ImportError:')
    lines.append('    print("ERROR: Quartz not available (macOS only)")')
    lines.append('    sys.exit(1)')
    lines.append('')
    lines.append('LOG_FILE = os.path.join("logs",')
    lines.append('    f"replay-{datetime.datetime.now().strftime(\'%Y%m%d-%H%M%S\')}.log")')
    lines.append('os.makedirs("logs", exist_ok=True)')
    lines.append('')
    lines.append('def log(msg):')
    lines.append('    ts = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]')
    lines.append('    line = f"[{ts}] {msg}"')
    lines.append('    print(line, flush=True)')
    lines.append('    with open(LOG_FILE, "a") as _f:')
    lines.append('        _f.write(line + "\\n")')
    lines.append('')
    lines.append('# Create HID event source (mimics real hardware)')
    lines.append('_src = CGEventSourceCreate(kCGEventSourceStateHIDSystemState)')
    lines.append('')
    lines.append('def _post(e):')
    lines.append('    CGEventSetSource(e, _src)')
    lines.append('    CGEventPost(kCGHIDEventTap, e)')
    lines.append('')
    lines.append('def mouse_move(x, y):')
    lines.append('    e = CGEventCreateMouseEvent(_src, kCGEventMouseMoved, (x, y), kCGMouseButtonLeft)')
    lines.append('    CGEventPost(kCGHIDEventTap, e)')
    lines.append('')
    lines.append('def mouse_click(x, y):')
    lines.append('    e_down = CGEventCreateMouseEvent(_src, kCGEventLeftMouseDown, (x, y), kCGMouseButtonLeft)')
    lines.append('    e_up   = CGEventCreateMouseEvent(_src, kCGEventLeftMouseUp, (x, y), kCGMouseButtonLeft)')
    lines.append('    CGEventPost(kCGHIDEventTap, e_down)')
    lines.append('    time.sleep(0.05)')
    lines.append('    CGEventPost(kCGHIDEventTap, e_up)')
    lines.append('')
    lines.append('def mouse_rclick(x, y):')
    lines.append('    e_down = CGEventCreateMouseEvent(_src, kCGEventRightMouseDown, (x, y), kCGMouseButtonRight)')
    lines.append('    e_up   = CGEventCreateMouseEvent(_src, kCGEventRightMouseUp, (x, y), kCGMouseButtonRight)')
    lines.append('    CGEventPost(kCGHIDEventTap, e_down)')
    lines.append('    time.sleep(0.05)')
    lines.append('    CGEventPost(kCGHIDEventTap, e_up)')
    lines.append('')
    lines.append('def do_scroll(dy=0, dx=0):')
    lines.append('    """Smart scroll: auto-amplifies line-unit values to pixels."""')
    lines.append('    PIXELS_PER_LINE = 40')
    lines.append('    py_dy = dy * PIXELS_PER_LINE if abs(dy) <= 10 and dy != 0 else dy')
    lines.append('    py_dx = dx * PIXELS_PER_LINE if abs(dx) <= 10 and dx != 0 else dx')
    lines.append('    if py_dy != 0:')
    lines.append('        e = CGEventCreateScrollWheelEvent(_src, kCGScrollEventUnitPixel, 1, int(py_dy))')
    lines.append('        CGEventPost(kCGHIDEventTap, e)')
    lines.append('    if py_dx != 0:')
    lines.append('        e = CGEventCreateScrollWheelEvent(_src, kCGScrollEventUnitPixel, 2, int(py_dx), 0)')
    lines.append('        CGEventPost(kCGHIDEventTap, e)')
    lines.append('')
    lines.append(f'log("=" * 60)')
    lines.append(f'log(f"REPLAY START  actions={len(replay_actions)}")')
    lines.append('time.sleep(1)')

    prev_elapsed = 0
    for i, ra in enumerate(replay_actions):
        atype = ra["type"]; x = ra["x"]; y = ra["y"]; elapsed = ra["elapsed"]

        delay = max(elapsed - prev_elapsed, 0.005)
        if delay > 0.015:
            lines.append(f'time.sleep({delay:.3f})')

        desc_map = {"move":"MOVE","click":"CLICK","right_click":"RCLICK",
                     "scroll_up":"SCROLL_UP","scroll_down":"SCROLL_DOWN",
                     "scroll_left":"SCROLL_LEFT","scroll_right":"SCROLL_RIGHT"}
        desc = desc_map.get(atype, atype)
        lines.append(f'log("[{i+1:>3}/{len(replay_actions)}] {desc}({x},{y}) t={elapsed:.2f}s")')

        if atype == "move":
            lines.append(f'mouse_move({x}, {y})')
        elif atype == "click":
            lines.append(f'mouse_click({x}, {y})')
        elif atype == "right_click":
            lines.append(f'mouse_rclick({x}, {y})')
        elif atype.startswith("scroll_"):
            sy = ra.get("dy", 0); sx = ra.get("dx", 0)
            lines.append(f'do_scroll(dy={sy}, dx={sx})')

        prev_elapsed = elapsed

    lines.append('')
    lines.append('log("")')
    lines.append('log("REPLAY COMPLETE")')
    lines.append(f'log(f"Log: {{LOG_FILE}}" )')

    with open(py_file, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    os.chmod(py_file, 0o755)
    output["replay_py_script"] = py_file

    print(f"\n  Replay script:     {py_file}")
    print(f"  Run:               python3 {py_file}")
    print(f"  Scroll unit:       PIXEL (kCGScrollEventUnitPixel)")
    print(f"  Source state:      HIDSystemState (mimics real hardware)")

print(flush=True)
