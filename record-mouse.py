#!/usr/bin/env python3
"""
Mouse operation recorder v4 - Hybrid mode.
- cliclick polling: mouse position + click detection (no permission needed)
- Quartz CGEventTap: scroll wheel events (may need accessibility permission)
Stops after 5s of inactivity.
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
INACTIVITY_TIMEOUT = 5.0
POLL_INTERVAL = 0.04  # 40ms
action_id = 0
start_time = time.time()

# Scroll tracking from Quartz
scroll_queue = deque()  # thread-safe queue for scroll events from Quartz thread
scroll_lock = threading.Lock()


def record_action(atype, x, y, **extra):
    global action_id, last_activity_time
    now = time.time()
    last_activity_time = now
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
    print(f"  [{action_id:>3}] {icon} ({int(x):>4},{int(y):>4}){detail} t={action['elapsed_s']:>7.2f}s",
          flush=True)


# === Screenshot ===
subprocess.run(
    ["screencapture", "-x", os.path.join(SCRIPT_DIR, "screenshots", "record-start.png")],
    capture_output=True
)

print("=" * 60)
print("  MOUSE RECORDER v4 (Hybrid: poll + Quartz scroll)")
print("=" * 60)
print(f"  Captures: move | click | right-click | SCROLL")
print(f"  Screenshot: screenshots/record-start.png")
print(f"  Output:     {OUTPUT_FILE}")
print(f"  Timeout:    {INACTIVITY_TIMEOUT}s inactivity")
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
        time.sleep(0.12)

threading.Thread(target=check_inactivity, daemon=True).start()


# === Quartz Scroll Listener (separate thread) ===
quartz_running = False

def quartz_scroll_listener():
    """Listen for scroll wheel events via Quartz CGEventTap."""
    global quartz_running
    quartz_running = True
    
    try:
        from Quartz import (
            CGEventTapCreate, CGEventTapEnable,
            kCGSessionEventTap, kCGHeadInsertEventTap,
            kCGEventTapOptionListenOnly, kCFRunLoopDefaultMode,
            CGEventGetLocation, CGEventGetType,
            CGEventGetIntegerValueField, kCGScrollWheelEventDeltaAxis1,
            kCGScrollWheelEventDeltaAxis2, kCGScrollWheelEventPointDeltaAxis1,
            kCGScrollWheelEventPointDeltaAxis2,
            CFMachPortCreateRunLoopSource, CFRunLoopAddSource,
            CFRunLoopGetCurrent, CFRunLoopRunInMode, CFRunLoopStop,
            kCGEventScrollWheel
        )
        
        def scroll_callback(proxy, etype, event, refcon):
            loc = CGEventGetLocation(event)
            dx = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis2)   # horizontal
            dy = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis1)     # vertical
            
            if dx != 0 or dy != 0:
                with scroll_lock:
                    scroll_queue.append({
                        "x": int(loc.x), "y": int(loc.y),
                        "dx": int(dx), "dy": int(dy),
                        "time": time.time()
                    })
            return event
        
        tap = CGEventTapCreate(
            kCGSessionEventTap, kCGHeadInsertEventTap,
            kCGEventTapOptionListenOnly,
            1 << kCGEventScrollWheel,  # only scroll events
            scroll_callback, None
        )
        
        if not tap:
            print("  [Scroll] Quartz tap failed (need Accessibility permission?)", flush=True)
            return
        
        source = CFMachPortCreateRunLoopSource(None, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopDefaultMode)
        CGEventTapEnable(tap, True)
        print("  [Scroll] Quartz scroll listener active", flush=True)
        
        # Run loop in small increments so thread can exit
        while is_recording:
            CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.2, True)
            
    except ImportError:
        print("  [Scroll] Quartz not available, scroll recording disabled", flush=True)
    except Exception as e:
        print(f"  [Scroll] Error: {e}", flush=True)

threading.Thread(target=quartz_scroll_listener, daemon=True).start()
time.sleep(0.3)  # give Quartz time to init


# === Main polling loop (position + click detection) ===
prev_x, prev_y = -9999, -9999
was_moving = False
still_start = None
move_before_still = None
STILL_THRESHOLD = 0.30  # 300ms stillness after move = likely click
last_scroll_flush = time.time()
SCROLL_FLUSH_GAP = 0.20  # merge scrolls within 200ms

print("\nRecording...\n", flush=True)

try:
    while is_recording:
        # 1. Poll mouse position via cliclick
        try:
            result = subprocess.run(
                ["cliclick", "p"], capture_output=True, text=True, timeout=0.8
            )
            parts = result.stdout.strip().split(",")
            if len(parts) >= 2:
                x, y = int(parts[0]), int(parts[1])
                
                dx = abs(x - prev_x)
                dy = abs(y - prev_y)
                
                if dx + dy > 3:
                    record_action("move", x, y)
                    prev_x, prev_y = x, y
                    was_moving = True
                    still_start = None
                elif was_moving and still_start is None:
                    still_start = time.time()
                    move_before_still = (x, y)
                elif still_start is not None:
                    if time.time() - still_start > STILL_THRESHOLD:
                        record_action("click", move_before_still[0], move_before_still[1])
                        was_moving = False
                        still_start = None
        except Exception:
            pass
        
        # 2. Check scroll events from Quartz thread
        now = time.time()
        with scroll_lock:
            pending_scrolls = list(scroll_queue)
            scroll_queue.clear()
        
        if pending_scrolls:
            # Accumulate all recent scrolls into one action
            total_dx = sum(s["dx"] for s in pending_scrolls)
            total_dy = sum(s["dy"] for s in pending_scrolls)
            # Use the latest position
            last_scroll = pending_scrolls[-1]
            
            if abs(total_dy) >= abs(total_dx):
                stype = "scroll_up" if total_dy > 0 else "scroll_down"
                sd = {"dy": total_dy}
            else:
                stype = "scroll_right" if total_dx > 0 else "scroll_left"
                sd = {"dx": total_dx}
            
            record_action(stype, last_scroll["x"], last_scroll["y"], **sd)
            last_scroll_flush = now
        
        time.sleep(POLL_INTERVAL)

except KeyboardInterrupt:
    print("\n\nInterrupted.", flush=True)
finally:
    is_recording = False


# === Save results ===
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
    
    # Generate replay commands
    # - move/click: use cliclick
    # - scroll: use Python+Quartz (cliclick has NO scroll support!)
    replay_cmds = []
    for a in simplified:
        if a["type"] in ("click", "right_click"):
            replay_cmds.append({"tool": "cliclick", "cmd": f"cliclick c:{a['x']},{a['y']}"})
        elif a["type"].startswith("scroll_"):
            direction = a["type"].replace("scroll_", "")
            if direction == "up":
                amt = max(abs(a.get("dy", 0)), 3)
                replay_cmds.append({
                    "tool": "python",
                    "cmd": f'python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,{amt});CGEventPost(kCGHIDEventTap,e)"',
                    "desc": f"scroll_up {amt}"
                })
            elif direction == "down":
                amt = max(abs(a.get("dy", 0)), 3)
                replay_cmds.append({
                    "tool": "python",
                    "cmd": f'python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-{amt});CGEventPost(kCGHIDEventTap,e)"',
                    "desc": f"scroll_down {amt}"
                })
            elif direction == "left":
                amt = max(abs(a.get("dx", 0)), 3)
                # axis2 for horizontal, negative = left
                replay_cmds.append({
                    "tool": "python",
                    "cmd": f'python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,2,-{amt},0);CGEventPost(kCGHIDEventTap,e)"',
                    "desc": f"scroll_left {amt}"
                })
            elif direction == "right":
                amt = max(abs(a.get("dx", 0)), 3)
                # axis2 for horizontal, positive = right
                replay_cmds.append({
                    "tool": "python",
                    "cmd": f'python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,2,{amt},0);CGEventPost(kCGHIDEventTap,e)"',
                    "desc": f"scroll_right {amt}"
                })
        else:
            replay_cmds.append({"tool": "cliclick", "cmd": f"cliclick m:{a['x']},{a['y']}"})
    
    output = {
        "version": "v4-hybrid",
        "recorded_at": datetime.now().isoformat(),
        "total_raw": len(recorded_actions),
        "simplified_count": len(simplified),
        "actions": recorded_actions,
        "simplified": simplified,
        "replay_commands": replay_cmds,
        "scroll_supported": bool(quartz_running and any(a["type"].startswith("scroll") for a in recorded_actions))
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
    print(f"  Raw actions:      {len(recorded_actions)}")
    print(f"  Simplified:       {len(simplified)}")
    print(f"  Scroll support:   {'YES' if output['scroll_supported'] else 'NO'}")
    for t, c in sorted(type_counts.items()):
        icons2 = {"move":"->","click":"[CLICK]","right_click":"[RIGHT]",
                  "scroll_up":"^UP^","scroll_down":"vDOWNv",
                  "scroll_left":"<LEFT<","scroll_right":">RIGHT>"}
        print(f"    {icons2.get(t,'?'):>10} {t}:  {c}")
    print(f"  Output:           {OUTPUT_FILE}")
    
    print(f"\n  Replay commands ({len(replay_cmds)}):")
    for i, rc in enumerate(replay_cmds):
        cmd = rc["cmd"]
        marker = ""
        if i < len(simplified):
            a = simplified[i]
            if a["type"] in ("click", "right_click"): marker = "  <-- CLICK"
            elif a["type"].startswith("scroll"): marker = f"  <-- {a['type'].upper()}"
        print(f"    {i+1:>3}. {cmd}{marker}")
    
    # Shell script for easy replay (with verbose logging)
    sh_file = OUTPUT_FILE + ".sh"
    log_file = OUTPUT_FILE.replace(".json", "-replay.log")
    with open(sh_file, 'w') as f:
        f.write("#!/bin/bash\n# Auto-generated mouse+scroll replay WITH LOGGING\n")
        f.write(f"# Recorded: {output['recorded_at']}\n# Tool: cliclick (move/click) + Python Quartz (scroll)\n#\n")
        f.write(f'LOG="{log_file}"\necho "=== REPLAY START: $(date)" | tee "$LOG"\necho "Total commands: {len(replay_cmds)}" | tee -a "$LOG"\necho "" | tee -a "$LOG"\n\n')
        
        for i, rc in enumerate(replay_cmds):
            cmd = rc["cmd"]
            tool = rc.get("tool", "cliclick")
            
            # Determine display info
            if tool == "cliclick":
                if "cliclick c:" in cmd:
                    atype = "CLICK"
                    coords = cmd.replace("cliclick c:", "")
                elif "cliclick m:" in cmd:
                    atype = "MOVE"
                    coords = cmd.replace("cliclick m:", "")
                elif "cliclick dc:" in cmd:
                    atype = "DOUBLE_CLICK"
                    coords = cmd.replace("cliclick dc:", "")
                else:
                    atype = "CMD"
                    coords = ""
                desc = f"{atype}({coords})"
            else:
                # python scroll
                desc = rc.get("desc", "SCROLL")
                
            # Write logged command block
            f.write(f'# --- Step {i+1}/{len(replay_cmds)}: {desc} ---\n')
            f.write(f'echo "[{i+1:>3}/{len(replay_cmds)}] EXECUTING: {desc}  CMD: {cmd}" | tee -a "$LOG"\n')
            f.write(f'{cmd} 2>&1 | tee -a "$LOG"\n')
            f.write('RET=$?\n')
            f.write(f'if [ $RET -ne 0 ]; then echo "[{i+1:>3}] WARNING: exit code=$RET" | tee -a "$LOG"; fi\n')
            
            # Delay
            if tool == "python":
                delay = 0.3
            elif "cliclick c:" in cmd or "cliclick dc:" in cmd:
                delay = 0.6
            else:
                delay = 0.4
            f.write(f'sleep {delay}\n')
            f.write(f'echo "" | tee -a "$LOG"\n')
        
        f.write('\necho "" | tee -a "$LOG"\n')
        f.write(f'echo "=== REPLAY COMPLETE: $(date) ===" | tee -a "$LOG"\n')
        f.write(f'echo "Log saved to: $LOG" | tee -a "$LOG"\n')
    os.chmod(sh_file, 0o755)
    print(f"\n  Shell script:     {sh_file}")

print(flush=True)
