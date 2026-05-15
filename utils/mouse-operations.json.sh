#!/bin/bash
STAMP=$(date +%Y%m%d-%H%M%S)
LOG="logs/replay-$STAMP.log"
echo "=== MOUSE REPLAY START $(date) ===" | tee "$LOG"
echo "Total steps: 219" | tee -a "$LOG"
sleep 1

# --- Step 1/219: MOVE(1060,853) ---
echo "[  1/219] EXECUTING: MOVE(1060,853)  CMD: cliclick m:1060,853" | tee -a "$LOG"
cliclick m:1060,853 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[  1] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 2/219: CLICK(1060,853) ---
echo "[  2/219] EXECUTING: CLICK(1060,853)  CMD: cliclick c:1060,853" | tee -a "$LOG"
cliclick c:1060,853 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[  2] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 3/219: MOVE(909,757) ---
echo "[  3/219] EXECUTING: MOVE(909,757)  CMD: cliclick m:909,757" | tee -a "$LOG"
cliclick m:909,757 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[  3] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 4/219: MOVE(848,736) ---
echo "[  4/219] EXECUTING: MOVE(848,736)  CMD: cliclick m:848,736" | tee -a "$LOG"
cliclick m:848,736 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[  4] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 5/219: MOVE(811,725) ---
echo "[  5/219] EXECUTING: MOVE(811,725)  CMD: cliclick m:811,725" | tee -a "$LOG"
cliclick m:811,725 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[  5] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 6/219: MOVE(781,713) ---
echo "[  6/219] EXECUTING: MOVE(781,713)  CMD: cliclick m:781,713" | tee -a "$LOG"
cliclick m:781,713 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[  6] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 7/219: MOVE(583,506) ---
echo "[  7/219] EXECUTING: MOVE(583,506)  CMD: cliclick m:583,506" | tee -a "$LOG"
cliclick m:583,506 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[  7] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 8/219: MOVE(561,487) ---
echo "[  8/219] EXECUTING: MOVE(561,487)  CMD: cliclick m:561,487" | tee -a "$LOG"
cliclick m:561,487 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[  8] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 9/219: MOVE(493,446) ---
echo "[  9/219] EXECUTING: MOVE(493,446)  CMD: cliclick m:493,446" | tee -a "$LOG"
cliclick m:493,446 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[  9] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 10/219: MOVE(466,435) ---
echo "[ 10/219] EXECUTING: MOVE(466,435)  CMD: cliclick m:466,435" | tee -a "$LOG"
cliclick m:466,435 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 10] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 11/219: MOVE(454,416) ---
echo "[ 11/219] EXECUTING: MOVE(454,416)  CMD: cliclick m:454,416" | tee -a "$LOG"
cliclick m:454,416 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 11] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 12/219: CLICK(450,407) ---
echo "[ 12/219] EXECUTING: CLICK(450,407)  CMD: cliclick c:450,407" | tee -a "$LOG"
cliclick c:450,407 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 12] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 13/219: MOVE(478,405) ---
echo "[ 13/219] EXECUTING: MOVE(478,405)  CMD: cliclick m:478,405" | tee -a "$LOG"
cliclick m:478,405 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 13] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 14/219: MOVE(609,394) ---
echo "[ 14/219] EXECUTING: MOVE(609,394)  CMD: cliclick m:609,394" | tee -a "$LOG"
cliclick m:609,394 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 14] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 15/219: MOVE(701,405) ---
echo "[ 15/219] EXECUTING: MOVE(701,405)  CMD: cliclick m:701,405" | tee -a "$LOG"
cliclick m:701,405 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 15] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 16/219: MOVE(722,409) ---
echo "[ 16/219] EXECUTING: MOVE(722,409)  CMD: cliclick m:722,409" | tee -a "$LOG"
cliclick m:722,409 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 16] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 17/219: CLICK(722,409) ---
echo "[ 17/219] EXECUTING: CLICK(722,409)  CMD: cliclick c:722,409" | tee -a "$LOG"
cliclick c:722,409 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 17] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 18/219: MOVE(808,406) ---
echo "[ 18/219] EXECUTING: MOVE(808,406)  CMD: cliclick m:808,406" | tee -a "$LOG"
cliclick m:808,406 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 18] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 19/219: MOVE(1061,410) ---
echo "[ 19/219] EXECUTING: MOVE(1061,410)  CMD: cliclick m:1061,410" | tee -a "$LOG"
cliclick m:1061,410 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 19] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 20/219: MOVE(958,419) ---
echo "[ 20/219] EXECUTING: MOVE(958,419)  CMD: cliclick m:958,419" | tee -a "$LOG"
cliclick m:958,419 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 20] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 21/219: MOVE(1003,438) ---
echo "[ 21/219] EXECUTING: MOVE(1003,438)  CMD: cliclick m:1003,438" | tee -a "$LOG"
cliclick m:1003,438 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 21] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 22/219: MOVE(1092,417) ---
echo "[ 22/219] EXECUTING: MOVE(1092,417)  CMD: cliclick m:1092,417" | tee -a "$LOG"
cliclick m:1092,417 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 22] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 23/219: MOVE(1174,393) ---
echo "[ 23/219] EXECUTING: MOVE(1174,393)  CMD: cliclick m:1174,393" | tee -a "$LOG"
cliclick m:1174,393 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 23] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 24/219: MOVE(1201,384) ---
echo "[ 24/219] EXECUTING: MOVE(1201,384)  CMD: cliclick m:1201,384" | tee -a "$LOG"
cliclick m:1201,384 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 24] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 25/219: MOVE(1219,374) ---
echo "[ 25/219] EXECUTING: MOVE(1219,374)  CMD: cliclick m:1219,374" | tee -a "$LOG"
cliclick m:1219,374 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 25] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 26/219: CLICK(1219,373) ---
echo "[ 26/219] EXECUTING: CLICK(1219,373)  CMD: cliclick c:1219,373" | tee -a "$LOG"
cliclick c:1219,373 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 26] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 27/219: MOVE(1067,386) ---
echo "[ 27/219] EXECUTING: MOVE(1067,386)  CMD: cliclick m:1067,386" | tee -a "$LOG"
cliclick m:1067,386 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 27] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 28/219: MOVE(936,413) ---
echo "[ 28/219] EXECUTING: MOVE(936,413)  CMD: cliclick m:936,413" | tee -a "$LOG"
cliclick m:936,413 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 28] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 29/219: MOVE(875,435) ---
echo "[ 29/219] EXECUTING: MOVE(875,435)  CMD: cliclick m:875,435" | tee -a "$LOG"
cliclick m:875,435 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 29] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 30/219: MOVE(774,486) ---
echo "[ 30/219] EXECUTING: MOVE(774,486)  CMD: cliclick m:774,486" | tee -a "$LOG"
cliclick m:774,486 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 30] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 31/219: MOVE(749,499) ---
echo "[ 31/219] EXECUTING: MOVE(749,499)  CMD: cliclick m:749,499" | tee -a "$LOG"
cliclick m:749,499 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 31] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 32/219: MOVE(807,502) ---
echo "[ 32/219] EXECUTING: MOVE(807,502)  CMD: cliclick m:807,502" | tee -a "$LOG"
cliclick m:807,502 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 32] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 33/219: CLICK(807,502) ---
echo "[ 33/219] EXECUTING: CLICK(807,502)  CMD: cliclick c:807,502" | tee -a "$LOG"
cliclick c:807,502 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 33] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 34/219: MOVE(707,495) ---
echo "[ 34/219] EXECUTING: MOVE(707,495)  CMD: cliclick m:707,495" | tee -a "$LOG"
cliclick m:707,495 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 34] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 35/219: MOVE(508,467) ---
echo "[ 35/219] EXECUTING: MOVE(508,467)  CMD: cliclick m:508,467" | tee -a "$LOG"
cliclick m:508,467 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 35] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 36/219: MOVE(324,448) ---
echo "[ 36/219] EXECUTING: MOVE(324,448)  CMD: cliclick m:324,448" | tee -a "$LOG"
cliclick m:324,448 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 36] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 37/219: MOVE(363,436) ---
echo "[ 37/219] EXECUTING: MOVE(363,436)  CMD: cliclick m:363,436" | tee -a "$LOG"
cliclick m:363,436 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 37] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 38/219: CLICK(364,435) ---
echo "[ 38/219] EXECUTING: CLICK(364,435)  CMD: cliclick c:364,435" | tee -a "$LOG"
cliclick c:364,435 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 38] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 39/219: scroll_down 1 ---
echo "[ 39/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 39] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 40/219: scroll_down 1 ---
echo "[ 40/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 40] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 41/219: scroll_down 1 ---
echo "[ 41/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 41] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 42/219: scroll_down 1 ---
echo "[ 42/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 42] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 43/219: scroll_down 1 ---
echo "[ 43/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 43] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 44/219: scroll_down 1 ---
echo "[ 44/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 44] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 45/219: scroll_down 1 ---
echo "[ 45/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 45] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 46/219: scroll_down 1 ---
echo "[ 46/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 46] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 47/219: scroll_down 1 ---
echo "[ 47/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 47] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 48/219: MOVE(397,436) ---
echo "[ 48/219] EXECUTING: MOVE(397,436)  CMD: cliclick m:397,436" | tee -a "$LOG"
cliclick m:397,436 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 48] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 49/219: MOVE(458,436) ---
echo "[ 49/219] EXECUTING: MOVE(458,436)  CMD: cliclick m:458,436" | tee -a "$LOG"
cliclick m:458,436 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 49] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 50/219: MOVE(566,433) ---
echo "[ 50/219] EXECUTING: MOVE(566,433)  CMD: cliclick m:566,433" | tee -a "$LOG"
cliclick m:566,433 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 50] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 51/219: MOVE(741,435) ---
echo "[ 51/219] EXECUTING: MOVE(741,435)  CMD: cliclick m:741,435" | tee -a "$LOG"
cliclick m:741,435 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 51] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 52/219: MOVE(899,434) ---
echo "[ 52/219] EXECUTING: MOVE(899,434)  CMD: cliclick m:899,434" | tee -a "$LOG"
cliclick m:899,434 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 52] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 53/219: MOVE(973,426) ---
echo "[ 53/219] EXECUTING: MOVE(973,426)  CMD: cliclick m:973,426" | tee -a "$LOG"
cliclick m:973,426 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 53] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 54/219: MOVE(1004,422) ---
echo "[ 54/219] EXECUTING: MOVE(1004,422)  CMD: cliclick m:1004,422" | tee -a "$LOG"
cliclick m:1004,422 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 54] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 55/219: MOVE(1066,412) ---
echo "[ 55/219] EXECUTING: MOVE(1066,412)  CMD: cliclick m:1066,412" | tee -a "$LOG"
cliclick m:1066,412 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 55] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 56/219: MOVE(1138,398) ---
echo "[ 56/219] EXECUTING: MOVE(1138,398)  CMD: cliclick m:1138,398" | tee -a "$LOG"
cliclick m:1138,398 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 56] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 57/219: MOVE(1182,390) ---
echo "[ 57/219] EXECUTING: MOVE(1182,390)  CMD: cliclick m:1182,390" | tee -a "$LOG"
cliclick m:1182,390 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 57] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 58/219: MOVE(1210,375) ---
echo "[ 58/219] EXECUTING: MOVE(1210,375)  CMD: cliclick m:1210,375" | tee -a "$LOG"
cliclick m:1210,375 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 58] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 59/219: MOVE(1226,366) ---
echo "[ 59/219] EXECUTING: MOVE(1226,366)  CMD: cliclick m:1226,366" | tee -a "$LOG"
cliclick m:1226,366 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 59] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 60/219: CLICK(1228,365) ---
echo "[ 60/219] EXECUTING: CLICK(1228,365)  CMD: cliclick c:1228,365" | tee -a "$LOG"
cliclick c:1228,365 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 60] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 61/219: MOVE(1073,388) ---
echo "[ 61/219] EXECUTING: MOVE(1073,388)  CMD: cliclick m:1073,388" | tee -a "$LOG"
cliclick m:1073,388 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 61] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 62/219: MOVE(965,418) ---
echo "[ 62/219] EXECUTING: MOVE(965,418)  CMD: cliclick m:965,418" | tee -a "$LOG"
cliclick m:965,418 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 62] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 63/219: MOVE(908,446) ---
echo "[ 63/219] EXECUTING: MOVE(908,446)  CMD: cliclick m:908,446" | tee -a "$LOG"
cliclick m:908,446 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 63] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 64/219: MOVE(889,459) ---
echo "[ 64/219] EXECUTING: MOVE(889,459)  CMD: cliclick m:889,459" | tee -a "$LOG"
cliclick m:889,459 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 64] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 65/219: MOVE(867,477) ---
echo "[ 65/219] EXECUTING: MOVE(867,477)  CMD: cliclick m:867,477" | tee -a "$LOG"
cliclick m:867,477 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 65] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 66/219: MOVE(807,499) ---
echo "[ 66/219] EXECUTING: MOVE(807,499)  CMD: cliclick m:807,499" | tee -a "$LOG"
cliclick m:807,499 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 66] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 67/219: CLICK(798,501) ---
echo "[ 67/219] EXECUTING: CLICK(798,501)  CMD: cliclick c:798,501" | tee -a "$LOG"
cliclick c:798,501 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 67] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 68/219: MOVE(713,485) ---
echo "[ 68/219] EXECUTING: MOVE(713,485)  CMD: cliclick m:713,485" | tee -a "$LOG"
cliclick m:713,485 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 68] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 69/219: MOVE(604,456) ---
echo "[ 69/219] EXECUTING: MOVE(604,456)  CMD: cliclick m:604,456" | tee -a "$LOG"
cliclick m:604,456 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 69] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 70/219: MOVE(492,433) ---
echo "[ 70/219] EXECUTING: MOVE(492,433)  CMD: cliclick m:492,433" | tee -a "$LOG"
cliclick m:492,433 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 70] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 71/219: MOVE(471,428) ---
echo "[ 71/219] EXECUTING: MOVE(471,428)  CMD: cliclick m:471,428" | tee -a "$LOG"
cliclick m:471,428 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 71] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 72/219: MOVE(417,421) ---
echo "[ 72/219] EXECUTING: MOVE(417,421)  CMD: cliclick m:417,421" | tee -a "$LOG"
cliclick m:417,421 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 72] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 73/219: CLICK(406,417) ---
echo "[ 73/219] EXECUTING: CLICK(406,417)  CMD: cliclick c:406,417" | tee -a "$LOG"
cliclick c:406,417 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 73] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 74/219: scroll_down 1 ---
echo "[ 74/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 74] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 75/219: scroll_down 1 ---
echo "[ 75/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 75] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 76/219: scroll_down 1 ---
echo "[ 76/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 76] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 77/219: scroll_down 1 ---
echo "[ 77/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 77] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 78/219: scroll_down 1 ---
echo "[ 78/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 78] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 79/219: scroll_down 1 ---
echo "[ 79/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 79] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 80/219: scroll_down 1 ---
echo "[ 80/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 80] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 81/219: scroll_down 1 ---
echo "[ 81/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 81] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 82/219: scroll_down 1 ---
echo "[ 82/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 82] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 83/219: scroll_down 1 ---
echo "[ 83/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 83] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 84/219: scroll_down 1 ---
echo "[ 84/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 84] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 85/219: scroll_down 1 ---
echo "[ 85/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 85] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 86/219: scroll_down 1 ---
echo "[ 86/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 86] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 87/219: scroll_down 1 ---
echo "[ 87/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 87] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 88/219: MOVE(421,416) ---
echo "[ 88/219] EXECUTING: MOVE(421,416)  CMD: cliclick m:421,416" | tee -a "$LOG"
cliclick m:421,416 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 88] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 89/219: MOVE(450,413) ---
echo "[ 89/219] EXECUTING: MOVE(450,413)  CMD: cliclick m:450,413" | tee -a "$LOG"
cliclick m:450,413 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 89] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 90/219: MOVE(469,413) ---
echo "[ 90/219] EXECUTING: MOVE(469,413)  CMD: cliclick m:469,413" | tee -a "$LOG"
cliclick m:469,413 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 90] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 91/219: MOVE(555,410) ---
echo "[ 91/219] EXECUTING: MOVE(555,410)  CMD: cliclick m:555,410" | tee -a "$LOG"
cliclick m:555,410 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 91] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 92/219: MOVE(963,431) ---
echo "[ 92/219] EXECUTING: MOVE(963,431)  CMD: cliclick m:963,431" | tee -a "$LOG"
cliclick m:963,431 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 92] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 93/219: MOVE(1063,432) ---
echo "[ 93/219] EXECUTING: MOVE(1063,432)  CMD: cliclick m:1063,432" | tee -a "$LOG"
cliclick m:1063,432 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 93] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 94/219: MOVE(1116,428) ---
echo "[ 94/219] EXECUTING: MOVE(1116,428)  CMD: cliclick m:1116,428" | tee -a "$LOG"
cliclick m:1116,428 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 94] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 95/219: MOVE(1132,422) ---
echo "[ 95/219] EXECUTING: MOVE(1132,422)  CMD: cliclick m:1132,422" | tee -a "$LOG"
cliclick m:1132,422 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 95] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 96/219: MOVE(1156,407) ---
echo "[ 96/219] EXECUTING: MOVE(1156,407)  CMD: cliclick m:1156,407" | tee -a "$LOG"
cliclick m:1156,407 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 96] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 97/219: MOVE(1181,389) ---
echo "[ 97/219] EXECUTING: MOVE(1181,389)  CMD: cliclick m:1181,389" | tee -a "$LOG"
cliclick m:1181,389 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 97] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 98/219: MOVE(1203,379) ---
echo "[ 98/219] EXECUTING: MOVE(1203,379)  CMD: cliclick m:1203,379" | tee -a "$LOG"
cliclick m:1203,379 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 98] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 99/219: MOVE(1220,370) ---
echo "[ 99/219] EXECUTING: MOVE(1220,370)  CMD: cliclick m:1220,370" | tee -a "$LOG"
cliclick m:1220,370 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[ 99] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 100/219: MOVE(1239,358) ---
echo "[100/219] EXECUTING: MOVE(1239,358)  CMD: cliclick m:1239,358" | tee -a "$LOG"
cliclick m:1239,358 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[100] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 101/219: CLICK(1239,358) ---
echo "[101/219] EXECUTING: CLICK(1239,358)  CMD: cliclick c:1239,358" | tee -a "$LOG"
cliclick c:1239,358 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[101] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 102/219: MOVE(1149,352) ---
echo "[102/219] EXECUTING: MOVE(1149,352)  CMD: cliclick m:1149,352" | tee -a "$LOG"
cliclick m:1149,352 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[102] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 103/219: MOVE(1057,354) ---
echo "[103/219] EXECUTING: MOVE(1057,354)  CMD: cliclick m:1057,354" | tee -a "$LOG"
cliclick m:1057,354 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[103] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 104/219: MOVE(969,367) ---
echo "[104/219] EXECUTING: MOVE(969,367)  CMD: cliclick m:969,367" | tee -a "$LOG"
cliclick m:969,367 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[104] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 105/219: MOVE(901,392) ---
echo "[105/219] EXECUTING: MOVE(901,392)  CMD: cliclick m:901,392" | tee -a "$LOG"
cliclick m:901,392 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[105] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 106/219: MOVE(870,408) ---
echo "[106/219] EXECUTING: MOVE(870,408)  CMD: cliclick m:870,408" | tee -a "$LOG"
cliclick m:870,408 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[106] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 107/219: MOVE(829,431) ---
echo "[107/219] EXECUTING: MOVE(829,431)  CMD: cliclick m:829,431" | tee -a "$LOG"
cliclick m:829,431 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[107] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 108/219: MOVE(804,466) ---
echo "[108/219] EXECUTING: MOVE(804,466)  CMD: cliclick m:804,466" | tee -a "$LOG"
cliclick m:804,466 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[108] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 109/219: MOVE(785,506) ---
echo "[109/219] EXECUTING: MOVE(785,506)  CMD: cliclick m:785,506" | tee -a "$LOG"
cliclick m:785,506 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[109] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 110/219: CLICK(795,502) ---
echo "[110/219] EXECUTING: CLICK(795,502)  CMD: cliclick c:795,502" | tee -a "$LOG"
cliclick c:795,502 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[110] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 111/219: MOVE(745,493) ---
echo "[111/219] EXECUTING: MOVE(745,493)  CMD: cliclick m:745,493" | tee -a "$LOG"
cliclick m:745,493 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[111] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 112/219: MOVE(686,479) ---
echo "[112/219] EXECUTING: MOVE(686,479)  CMD: cliclick m:686,479" | tee -a "$LOG"
cliclick m:686,479 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[112] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 113/219: MOVE(531,439) ---
echo "[113/219] EXECUTING: MOVE(531,439)  CMD: cliclick m:531,439" | tee -a "$LOG"
cliclick m:531,439 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[113] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 114/219: MOVE(415,405) ---
echo "[114/219] EXECUTING: MOVE(415,405)  CMD: cliclick m:415,405" | tee -a "$LOG"
cliclick m:415,405 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[114] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 115/219: MOVE(397,401) ---
echo "[115/219] EXECUTING: MOVE(397,401)  CMD: cliclick m:397,401" | tee -a "$LOG"
cliclick m:397,401 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[115] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 116/219: CLICK(397,401) ---
echo "[116/219] EXECUTING: CLICK(397,401)  CMD: cliclick c:397,401" | tee -a "$LOG"
cliclick c:397,401 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[116] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 117/219: scroll_down 1 ---
echo "[117/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[117] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 118/219: scroll_down 1 ---
echo "[118/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[118] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 119/219: scroll_down 1 ---
echo "[119/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[119] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 120/219: scroll_down 1 ---
echo "[120/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[120] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 121/219: scroll_down 1 ---
echo "[121/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[121] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 122/219: scroll_down 1 ---
echo "[122/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[122] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 123/219: scroll_down 1 ---
echo "[123/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[123] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 124/219: MOVE(440,401) ---
echo "[124/219] EXECUTING: MOVE(440,401)  CMD: cliclick m:440,401" | tee -a "$LOG"
cliclick m:440,401 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[124] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 125/219: MOVE(546,396) ---
echo "[125/219] EXECUTING: MOVE(546,396)  CMD: cliclick m:546,396" | tee -a "$LOG"
cliclick m:546,396 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[125] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 126/219: MOVE(903,396) ---
echo "[126/219] EXECUTING: MOVE(903,396)  CMD: cliclick m:903,396" | tee -a "$LOG"
cliclick m:903,396 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[126] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 127/219: MOVE(1067,399) ---
echo "[127/219] EXECUTING: MOVE(1067,399)  CMD: cliclick m:1067,399" | tee -a "$LOG"
cliclick m:1067,399 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[127] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 128/219: MOVE(1165,399) ---
echo "[128/219] EXECUTING: MOVE(1165,399)  CMD: cliclick m:1165,399" | tee -a "$LOG"
cliclick m:1165,399 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[128] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 129/219: MOVE(1200,392) ---
echo "[129/219] EXECUTING: MOVE(1200,392)  CMD: cliclick m:1200,392" | tee -a "$LOG"
cliclick m:1200,392 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[129] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 130/219: MOVE(1223,384) ---
echo "[130/219] EXECUTING: MOVE(1223,384)  CMD: cliclick m:1223,384" | tee -a "$LOG"
cliclick m:1223,384 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[130] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 131/219: MOVE(1238,366) ---
echo "[131/219] EXECUTING: MOVE(1238,366)  CMD: cliclick m:1238,366" | tee -a "$LOG"
cliclick m:1238,366 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[131] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 132/219: CLICK(1241,361) ---
echo "[132/219] EXECUTING: CLICK(1241,361)  CMD: cliclick c:1241,361" | tee -a "$LOG"
cliclick c:1241,361 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[132] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 133/219: MOVE(1201,356) ---
echo "[133/219] EXECUTING: MOVE(1201,356)  CMD: cliclick m:1201,356" | tee -a "$LOG"
cliclick m:1201,356 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[133] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 134/219: MOVE(1103,363) ---
echo "[134/219] EXECUTING: MOVE(1103,363)  CMD: cliclick m:1103,363" | tee -a "$LOG"
cliclick m:1103,363 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[134] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 135/219: MOVE(1002,379) ---
echo "[135/219] EXECUTING: MOVE(1002,379)  CMD: cliclick m:1002,379" | tee -a "$LOG"
cliclick m:1002,379 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[135] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 136/219: MOVE(897,396) ---
echo "[136/219] EXECUTING: MOVE(897,396)  CMD: cliclick m:897,396" | tee -a "$LOG"
cliclick m:897,396 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[136] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 137/219: MOVE(844,427) ---
echo "[137/219] EXECUTING: MOVE(844,427)  CMD: cliclick m:844,427" | tee -a "$LOG"
cliclick m:844,427 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[137] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 138/219: MOVE(825,449) ---
echo "[138/219] EXECUTING: MOVE(825,449)  CMD: cliclick m:825,449" | tee -a "$LOG"
cliclick m:825,449 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[138] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 139/219: MOVE(816,466) ---
echo "[139/219] EXECUTING: MOVE(816,466)  CMD: cliclick m:816,466" | tee -a "$LOG"
cliclick m:816,466 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[139] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 140/219: MOVE(802,489) ---
echo "[140/219] EXECUTING: MOVE(802,489)  CMD: cliclick m:802,489" | tee -a "$LOG"
cliclick m:802,489 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[140] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 141/219: CLICK(800,496) ---
echo "[141/219] EXECUTING: CLICK(800,496)  CMD: cliclick c:800,496" | tee -a "$LOG"
cliclick c:800,496 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[141] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 142/219: MOVE(757,487) ---
echo "[142/219] EXECUTING: MOVE(757,487)  CMD: cliclick m:757,487" | tee -a "$LOG"
cliclick m:757,487 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[142] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 143/219: MOVE(570,449) ---
echo "[143/219] EXECUTING: MOVE(570,449)  CMD: cliclick m:570,449" | tee -a "$LOG"
cliclick m:570,449 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[143] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 144/219: MOVE(487,428) ---
echo "[144/219] EXECUTING: MOVE(487,428)  CMD: cliclick m:487,428" | tee -a "$LOG"
cliclick m:487,428 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[144] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 145/219: MOVE(461,422) ---
echo "[145/219] EXECUTING: MOVE(461,422)  CMD: cliclick m:461,422" | tee -a "$LOG"
cliclick m:461,422 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[145] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 146/219: CLICK(461,422) ---
echo "[146/219] EXECUTING: CLICK(461,422)  CMD: cliclick c:461,422" | tee -a "$LOG"
cliclick c:461,422 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[146] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 147/219: scroll_down 1 ---
echo "[147/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[147] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 148/219: scroll_down 1 ---
echo "[148/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[148] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 149/219: scroll_down 1 ---
echo "[149/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[149] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 150/219: scroll_down 1 ---
echo "[150/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[150] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 151/219: scroll_down 1 ---
echo "[151/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[151] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 152/219: scroll_down 1 ---
echo "[152/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[152] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 153/219: scroll_down 2 ---
echo "[153/219] EXECUTING: scroll_down 2  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-2);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-2);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[153] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 154/219: scroll_down 5 ---
echo "[154/219] EXECUTING: scroll_down 5  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-5);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-5);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[154] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 155/219: scroll_down 1 ---
echo "[155/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[155] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 156/219: scroll_up 1 ---
echo "[156/219] EXECUTING: scroll_up 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[156] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 157/219: scroll_up 1 ---
echo "[157/219] EXECUTING: scroll_up 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[157] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 158/219: scroll_up 1 ---
echo "[158/219] EXECUTING: scroll_up 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[158] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 159/219: MOVE(536,409) ---
echo "[159/219] EXECUTING: MOVE(536,409)  CMD: cliclick m:536,409" | tee -a "$LOG"
cliclick m:536,409 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[159] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 160/219: MOVE(690,386) ---
echo "[160/219] EXECUTING: MOVE(690,386)  CMD: cliclick m:690,386" | tee -a "$LOG"
cliclick m:690,386 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[160] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 161/219: MOVE(995,393) ---
echo "[161/219] EXECUTING: MOVE(995,393)  CMD: cliclick m:995,393" | tee -a "$LOG"
cliclick m:995,393 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[161] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 162/219: MOVE(1046,391) ---
echo "[162/219] EXECUTING: MOVE(1046,391)  CMD: cliclick m:1046,391" | tee -a "$LOG"
cliclick m:1046,391 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[162] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 163/219: MOVE(1072,390) ---
echo "[163/219] EXECUTING: MOVE(1072,390)  CMD: cliclick m:1072,390" | tee -a "$LOG"
cliclick m:1072,390 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[163] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 164/219: MOVE(1112,384) ---
echo "[164/219] EXECUTING: MOVE(1112,384)  CMD: cliclick m:1112,384" | tee -a "$LOG"
cliclick m:1112,384 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[164] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 165/219: MOVE(1129,381) ---
echo "[165/219] EXECUTING: MOVE(1129,381)  CMD: cliclick m:1129,381" | tee -a "$LOG"
cliclick m:1129,381 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[165] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 166/219: MOVE(1162,374) ---
echo "[166/219] EXECUTING: MOVE(1162,374)  CMD: cliclick m:1162,374" | tee -a "$LOG"
cliclick m:1162,374 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[166] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 167/219: MOVE(1199,368) ---
echo "[167/219] EXECUTING: MOVE(1199,368)  CMD: cliclick m:1199,368" | tee -a "$LOG"
cliclick m:1199,368 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[167] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 168/219: MOVE(1221,364) ---
echo "[168/219] EXECUTING: MOVE(1221,364)  CMD: cliclick m:1221,364" | tee -a "$LOG"
cliclick m:1221,364 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[168] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 169/219: CLICK(1223,363) ---
echo "[169/219] EXECUTING: CLICK(1223,363)  CMD: cliclick c:1223,363" | tee -a "$LOG"
cliclick c:1223,363 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[169] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 170/219: MOVE(1073,380) ---
echo "[170/219] EXECUTING: MOVE(1073,380)  CMD: cliclick m:1073,380" | tee -a "$LOG"
cliclick m:1073,380 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[170] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 171/219: MOVE(939,404) ---
echo "[171/219] EXECUTING: MOVE(939,404)  CMD: cliclick m:939,404" | tee -a "$LOG"
cliclick m:939,404 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[171] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 172/219: MOVE(828,438) ---
echo "[172/219] EXECUTING: MOVE(828,438)  CMD: cliclick m:828,438" | tee -a "$LOG"
cliclick m:828,438 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[172] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 173/219: MOVE(799,451) ---
echo "[173/219] EXECUTING: MOVE(799,451)  CMD: cliclick m:799,451" | tee -a "$LOG"
cliclick m:799,451 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[173] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 174/219: MOVE(782,499) ---
echo "[174/219] EXECUTING: MOVE(782,499)  CMD: cliclick m:782,499" | tee -a "$LOG"
cliclick m:782,499 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[174] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 175/219: MOVE(784,517) ---
echo "[175/219] EXECUTING: MOVE(784,517)  CMD: cliclick m:784,517" | tee -a "$LOG"
cliclick m:784,517 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[175] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 176/219: MOVE(801,499) ---
echo "[176/219] EXECUTING: MOVE(801,499)  CMD: cliclick m:801,499" | tee -a "$LOG"
cliclick m:801,499 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[176] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 177/219: CLICK(802,496) ---
echo "[177/219] EXECUTING: CLICK(802,496)  CMD: cliclick c:802,496" | tee -a "$LOG"
cliclick c:802,496 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[177] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 178/219: MOVE(737,490) ---
echo "[178/219] EXECUTING: MOVE(737,490)  CMD: cliclick m:737,490" | tee -a "$LOG"
cliclick m:737,490 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[178] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 179/219: MOVE(648,486) ---
echo "[179/219] EXECUTING: MOVE(648,486)  CMD: cliclick m:648,486" | tee -a "$LOG"
cliclick m:648,486 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[179] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 180/219: MOVE(485,478) ---
echo "[180/219] EXECUTING: MOVE(485,478)  CMD: cliclick m:485,478" | tee -a "$LOG"
cliclick m:485,478 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[180] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 181/219: MOVE(462,475) ---
echo "[181/219] EXECUTING: MOVE(462,475)  CMD: cliclick m:462,475" | tee -a "$LOG"
cliclick m:462,475 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[181] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 182/219: MOVE(454,459) ---
echo "[182/219] EXECUTING: MOVE(454,459)  CMD: cliclick m:454,459" | tee -a "$LOG"
cliclick m:454,459 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[182] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 183/219: MOVE(447,437) ---
echo "[183/219] EXECUTING: MOVE(447,437)  CMD: cliclick m:447,437" | tee -a "$LOG"
cliclick m:447,437 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[183] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 184/219: MOVE(446,416) ---
echo "[184/219] EXECUTING: MOVE(446,416)  CMD: cliclick m:446,416" | tee -a "$LOG"
cliclick m:446,416 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[184] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 185/219: scroll_down 1 ---
echo "[185/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[185] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 186/219: CLICK(446,416) ---
echo "[186/219] EXECUTING: CLICK(446,416)  CMD: cliclick c:446,416" | tee -a "$LOG"
cliclick c:446,416 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[186] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 187/219: scroll_down 1 ---
echo "[187/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[187] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 188/219: scroll_down 1 ---
echo "[188/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[188] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 189/219: scroll_down 1 ---
echo "[189/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[189] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 190/219: scroll_down 1 ---
echo "[190/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[190] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 191/219: scroll_down 1 ---
echo "[191/219] EXECUTING: scroll_down 1  CMD: python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)\"" | tee -a "$LOG"
python3 -c "from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-1);CGEventPost(kCGHIDEventTap,e)" 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[191] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.3
echo "" | tee -a "$LOG"
# --- Step 192/219: MOVE(472,415) ---
echo "[192/219] EXECUTING: MOVE(472,415)  CMD: cliclick m:472,415" | tee -a "$LOG"
cliclick m:472,415 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[192] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 193/219: MOVE(600,407) ---
echo "[193/219] EXECUTING: MOVE(600,407)  CMD: cliclick m:600,407" | tee -a "$LOG"
cliclick m:600,407 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[193] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 194/219: MOVE(658,404) ---
echo "[194/219] EXECUTING: MOVE(658,404)  CMD: cliclick m:658,404" | tee -a "$LOG"
cliclick m:658,404 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[194] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 195/219: MOVE(847,388) ---
echo "[195/219] EXECUTING: MOVE(847,388)  CMD: cliclick m:847,388" | tee -a "$LOG"
cliclick m:847,388 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[195] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 196/219: MOVE(863,389) ---
echo "[196/219] EXECUTING: MOVE(863,389)  CMD: cliclick m:863,389" | tee -a "$LOG"
cliclick m:863,389 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[196] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 197/219: MOVE(936,393) ---
echo "[197/219] EXECUTING: MOVE(936,393)  CMD: cliclick m:936,393" | tee -a "$LOG"
cliclick m:936,393 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[197] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 198/219: MOVE(1033,397) ---
echo "[198/219] EXECUTING: MOVE(1033,397)  CMD: cliclick m:1033,397" | tee -a "$LOG"
cliclick m:1033,397 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[198] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 199/219: MOVE(1087,401) ---
echo "[199/219] EXECUTING: MOVE(1087,401)  CMD: cliclick m:1087,401" | tee -a "$LOG"
cliclick m:1087,401 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[199] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 200/219: MOVE(1117,402) ---
echo "[200/219] EXECUTING: MOVE(1117,402)  CMD: cliclick m:1117,402" | tee -a "$LOG"
cliclick m:1117,402 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[200] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 201/219: MOVE(1175,396) ---
echo "[201/219] EXECUTING: MOVE(1175,396)  CMD: cliclick m:1175,396" | tee -a "$LOG"
cliclick m:1175,396 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[201] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 202/219: MOVE(1209,385) ---
echo "[202/219] EXECUTING: MOVE(1209,385)  CMD: cliclick m:1209,385" | tee -a "$LOG"
cliclick m:1209,385 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[202] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 203/219: MOVE(1229,380) ---
echo "[203/219] EXECUTING: MOVE(1229,380)  CMD: cliclick m:1229,380" | tee -a "$LOG"
cliclick m:1229,380 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[203] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 204/219: MOVE(1245,362) ---
echo "[204/219] EXECUTING: MOVE(1245,362)  CMD: cliclick m:1245,362" | tee -a "$LOG"
cliclick m:1245,362 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[204] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 205/219: CLICK(1246,361) ---
echo "[205/219] EXECUTING: CLICK(1246,361)  CMD: cliclick c:1246,361" | tee -a "$LOG"
cliclick c:1246,361 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[205] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"
# --- Step 206/219: MOVE(1226,358) ---
echo "[206/219] EXECUTING: MOVE(1226,358)  CMD: cliclick m:1226,358" | tee -a "$LOG"
cliclick m:1226,358 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[206] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 207/219: MOVE(1149,356) ---
echo "[207/219] EXECUTING: MOVE(1149,356)  CMD: cliclick m:1149,356" | tee -a "$LOG"
cliclick m:1149,356 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[207] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 208/219: MOVE(1095,352) ---
echo "[208/219] EXECUTING: MOVE(1095,352)  CMD: cliclick m:1095,352" | tee -a "$LOG"
cliclick m:1095,352 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[208] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 209/219: MOVE(943,345) ---
echo "[209/219] EXECUTING: MOVE(943,345)  CMD: cliclick m:943,345" | tee -a "$LOG"
cliclick m:943,345 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[209] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 210/219: MOVE(896,345) ---
echo "[210/219] EXECUTING: MOVE(896,345)  CMD: cliclick m:896,345" | tee -a "$LOG"
cliclick m:896,345 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[210] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 211/219: MOVE(806,352) ---
echo "[211/219] EXECUTING: MOVE(806,352)  CMD: cliclick m:806,352" | tee -a "$LOG"
cliclick m:806,352 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[211] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 212/219: MOVE(745,364) ---
echo "[212/219] EXECUTING: MOVE(745,364)  CMD: cliclick m:745,364" | tee -a "$LOG"
cliclick m:745,364 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[212] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 213/219: MOVE(738,422) ---
echo "[213/219] EXECUTING: MOVE(738,422)  CMD: cliclick m:738,422" | tee -a "$LOG"
cliclick m:738,422 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[213] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 214/219: MOVE(785,454) ---
echo "[214/219] EXECUTING: MOVE(785,454)  CMD: cliclick m:785,454" | tee -a "$LOG"
cliclick m:785,454 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[214] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 215/219: MOVE(879,494) ---
echo "[215/219] EXECUTING: MOVE(879,494)  CMD: cliclick m:879,494" | tee -a "$LOG"
cliclick m:879,494 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[215] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 216/219: MOVE(859,496) ---
echo "[216/219] EXECUTING: MOVE(859,496)  CMD: cliclick m:859,496" | tee -a "$LOG"
cliclick m:859,496 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[216] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 217/219: MOVE(825,498) ---
echo "[217/219] EXECUTING: MOVE(825,498)  CMD: cliclick m:825,498" | tee -a "$LOG"
cliclick m:825,498 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[217] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 218/219: MOVE(806,499) ---
echo "[218/219] EXECUTING: MOVE(806,499)  CMD: cliclick m:806,499" | tee -a "$LOG"
cliclick m:806,499 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[218] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.4
echo "" | tee -a "$LOG"
# --- Step 219/219: CLICK(806,499) ---
echo "[219/219] EXECUTING: CLICK(806,499)  CMD: cliclick c:806,499" | tee -a "$LOG"
cliclick c:806,499 2>&1 | tee -a "$LOG"
RET=$?
if [ $RET -ne 0 ]; then echo "[219] WARNING: exit code=$RET" | tee -a "$LOG"; fi
sleep 0.6
echo "" | tee -a "$LOG"

echo "" | tee -a "$LOG"
echo "=== REPLAY COMPLETE: $(date) ===" | tee -a "$LOG"
echo "Log saved to: $LOG"
