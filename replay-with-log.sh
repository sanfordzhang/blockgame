#!/bin/bash
# Replay script WITH detailed logging
# Generated from: mouse-operations.json
# Usage: sh replay-with-log.sh

LOG="/Users/yingfengzhang/1JackSource/blockchain/game-core/logs/replay-$(date +%Y%m%d-%H%M%S).log"
TOTAL=209  # total command count

echo "=== REPLAY START: $(date) ===" | tee "$LOG"
echo "Total steps: $TOTAL" | tee -a "$LOG"
echo "" | tee -a "$LOG"

STEP=0

run_cmd() {
    STEP=$((STEP + 1))
    local cmd="$1"
    local desc="$2"
    
    echo "[${STEP}/${TOTAL}] ${desc}  CMD: ${cmd}" | tee -a "$LOG"
    
    eval "$cmd" >>"$LOG" 2>&1
    RET=$?
    
    if [ $RET -ne 0 ]; then
        echo "[${STEP}] !! FAILED (exit=$RET) !!" | tee -a "$LOG"
    else
        echo "[${STEP}] OK" | tee -a "$LOG"
    fi
    echo "" | tee -a "$LOG"
}

# ===== REPLAY COMMANDS =====

run_cmd "cliclick m:2718,718"           "MOVE(2718,718)"
sleep 0.4
run_cmd "cliclick c:2718,718"           "CLICK(2718,718)"
sleep 0.6
run_cmd "cliclick m:2676,718"           "MOVE(2676,718)"
sleep 0.4
run_cmd "cliclick m:2051,676"           "MOVE(2051,676)"
sleep 0.4
run_cmd "cliclick m:1563,641"           "MOVE(1563,641)"
sleep 0.4
run_cmd "cliclick m:1357,624"           "MOVE(1357,624)"
sleep 0.4
run_cmd "cliclick m:1066,594"           "MOVE(1066,594)"
sleep 0.4
run_cmd "cliclick m:664,544"            "MOVE(664,544)"
sleep 0.4
run_cmd "cliclick m:552,482"            "MOVE(552,482)"
sleep 0.4
run_cmd "cliclick m:467,427"            "MOVE(467,427)"
sleep 0.4
run_cmd "cliclick m:442,399"            "MOVE(442,399)"
sleep 0.4
run_cmd "cliclick m:355,357"            "MOVE(355,357)"
sleep 0.4
run_cmd "cliclick m:373,361"            "MOVE(373,361)"
sleep 0.4
run_cmd "cliclick c:373,361"            "CLICK(373,361)"
sleep 0.6
run_cmd "cliclick m:462,341"            "MOVE(462,341)"
sleep 0.4
run_cmd "cliclick m:837,338"            "MOVE(837,338)"
sleep 0.4
run_cmd "cliclick m:1089,362"           "MOVE(1089,362)"
sleep 0.4
run_cmd "cliclick m:1130,366"           "MOVE(1130,366)"
sleep 0.4
run_cmd "cliclick m:1168,360"           "MOVE(1168,360)"
sleep 0.4
run_cmd "cliclick m:1225,376"           "MOVE(1225,376)"
sleep 0.4
run_cmd "cliclick c:1225,376"           "CLICK(1225,376)"
sleep 0.6
run_cmd "cliclick m:999,444"            "MOVE(999,444)"
sleep 0.4
run_cmd "cliclick m:809,500"            "MOVE(809,500)"
sleep 0.4
run_cmd "cliclick m:807,526"            "MOVE(807,526)"
sleep 0.4
run_cmd "cliclick m:807,547"            "MOVE(807,547)"
sleep 0.4
run_cmd "cliclick m:805,595"            "MOVE(805,595)"
sleep 0.4
run_cmd "cliclick c:805,595"            "CLICK(805,595)"
sleep 0.6
run_cmd "cliclick m:741,568"            "MOVE(741,568)"
sleep 0.4
run_cmd "cliclick m:506,503"            "MOVE(506,503)"
sleep 0.4
run_cmd "cliclick m:466,488"            "MOVE(466,488)"
sleep 0.4
run_cmd "cliclick m:444,487"            "MOVE(444,487)"
sleep 0.4
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "cliclick m:428,484"            "MOVE(428,484)"
sleep 0.4
run_cmd "cliclick m:407,464"            "MOVE(407,464)"
sleep 0.4
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "cliclick m:371,425"            "MOVE(371,425)"
sleep 0.4
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "cliclick c:368,413"            "CLICK(368,413)"
sleep 0.6
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "cliclick c:368,401"            "CLICK(368,401)"
sleep 0.6
run_cmd "cliclick m:424,395"            "MOVE(424,395)"
sleep 0.4
run_cmd "cliclick m:644,374"            "MOVE(644,374)"
sleep 0.4
run_cmd "cliclick m:797,372"            "MOVE(797,372)"
sleep 0.4
run_cmd "cliclick m:939,372"            "MOVE(939,372)"
sleep 0.4
run_cmd "cliclick m:992,367"            "MOVE(992,367)"
sleep 0.4
run_cmd "cliclick m:1048,365"           "MOVE(1048,365)"
sleep 0.4
run_cmd "cliclick m:1105,359"           "MOVE(1105,359)"
sleep 0.4
run_cmd "cliclick m:1154,356"           "MOVE(1154,356)"
sleep 0.4
run_cmd "cliclick m:1183,354"           "MOVE(1183,354)"
sleep 0.4
run_cmd "cliclick m:1200,355"           "MOVE(1200,355)"
sleep 0.4
run_cmd "cliclick m:1229,357"           "MOVE(1229,357)"
sleep 0.4
run_cmd "cliclick c:1229,357"           "CLICK(1229,357)"
sleep 0.6
run_cmd "cliclick m:1207,358"           "MOVE(1207,358)"
sleep 0.4
run_cmd "cliclick m:1151,370"           "MOVE(1151,370)"
sleep 0.4
run_cmd "cliclick m:1057,396"           "MOVE(1057,396)"
sleep 0.4
run_cmd "cliclick m:966,433"            "MOVE(966,433)"
sleep 0.4
run_cmd "cliclick m:914,456"            "MOVE(914,456)"
sleep 0.4
run_cmd "cliclick m:829,515"            "MOVE(829,515)"
sleep 0.4
run_cmd "cliclick m:812,541"            "MOVE(812,541)"
sleep 0.4
run_cmd "cliclick m:803,565"            "MOVE(803,565)"
sleep 0.4
run_cmd "cliclick m:799,585"            "MOVE(799,585)"
sleep 0.4
run_cmd "cliclick c:799,587"            "CLICK(799,587)"
sleep 0.6
run_cmd "cliclick m:762,578"            "MOVE(762,578)"
sleep 0.4
run_cmd "cliclick m:690,568"            "MOVE(690,568)"
sleep 0.4
run_cmd "cliclick m:556,553"            "MOVE(556,553)"
sleep 0.4
run_cmd "cliclick m:519,550"            "MOVE(519,550)"
sleep 0.4
run_cmd "cliclick m:500,549"            "MOVE(500,549)"
sleep 0.4
run_cmd "cliclick m:474,546"            "MOVE(474,546)"
sleep 0.4
run_cmd "cliclick m:437,544"            "MOVE(437,544)"
sleep 0.4
run_cmd "cliclick m:414,542"            "MOVE(414,542)"
sleep 0.4
run_cmd "cliclick c:407,542"            "CLICK(407,542)"
sleep 0.6
run_cmd "cliclick m:616,452"            "MOVE(616,452)"
sleep 0.4
run_cmd "cliclick m:648,441"            "MOVE(648,441)"
sleep 0.4
run_cmd "cliclick m:767,425"            "MOVE(767,425)"
sleep 0.4
run_cmd "cliclick m:995,407"            "MOVE(995,407)"
sleep 0.4
run_cmd "cliclick m:1108,400"           "MOVE(1108,400)"
sleep 0.4
run_cmd "cliclick m:1141,394"           "MOVE(1141,394)"
sleep 0.4
run_cmd "cliclick m:1175,387"           "MOVE(1175,387)"
sleep 0.4
run_cmd "cliclick m:1201,382"           "MOVE(1201,382)"
sleep 0.4
run_cmd "cliclick m:1218,376"           "MOVE(1218,376)"
sleep 0.4
run_cmd "cliclick c:1230,365"           "CLICK(1230,365)"
sleep 0.6
run_cmd "cliclick m:1161,396"           "MOVE(1161,396)"
sleep 0.4
run_cmd "cliclick m:1048,446"           "MOVE(1048,446)"
sleep 0.4
run_cmd "cliclick m:962,491"            "MOVE(962,491)"
sleep 0.4
run_cmd "cliclick m:854,549"            "MOVE(854,549)"
sleep 0.4
run_cmd "cliclick m:819,567"            "MOVE(819,567)"
sleep 0.4
run_cmd "cliclick m:794,580"            "MOVE(794,580)"
sleep 0.4
run_cmd "cliclick c:785,587"            "CLICK(785,587)"
sleep 0.6
run_cmd "cliclick m:674,547"            "MOVE(674,547)"
sleep 0.4
run_cmd "cliclick m:528,504"            "MOVE(528,504)"
sleep 0.4
run_cmd "cliclick m:506,498"            "MOVE(506,498)"
sleep 0.4
run_cmd "cliclick m:459,495"            "MOVE(459,495)"
sleep 0.4
run_cmd "cliclick m:441,491"            "MOVE(441,491)"
sleep 0.4
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "cliclick c:441,491"            "CLICK(441,491)"
sleep 0.6
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "cliclick m:555,473"            "MOVE(555,473)"
sleep 0.4
run_cmd "cliclick m:673,459"            "MOVE(673,459)"
sleep 0.4
run_cmd "cliclick m:893,442"            "MOVE(893,442)"
sleep 0.4
run_cmd "cliclick m:985,435"            "MOVE(985,435)"
sleep 0.4
run_cmd "cliclick m:1120,423"           "MOVE(1120,423)"
sleep 0.4
run_cmd "cliclick m:1176,413"           "MOVE(1176,413)"
sleep 0.4
run_cmd "cliclick m:1194,406"           "MOVE(1194,406)"
sleep 0.4
run_cmd "cliclick m:1215,390"           "MOVE(1215,390)"
sleep 0.4
run_cmd "cliclick m:1225,372"           "MOVE(1225,372)"
sleep 0.4
run_cmd "cliclick c:1229,362"           "CLICK(1229,362)"
sleep 0.6
run_cmd "cliclick m:1132,361"           "MOVE(1132,361)"
sleep 0.4
run_cmd "cliclick m:1032,384"           "MOVE(1032,384)"
sleep 0.4
run_cmd "cliclick m:970,397"            "MOVE(970,397)"
sleep 0.4
run_cmd "cliclick m:879,454"            "MOVE(879,454)"
sleep 0.4
run_cmd "cliclick m:828,507"            "MOVE(828,507)"
sleep 0.4
run_cmd "cliclick m:813,537"            "MOVE(813,537)"
sleep 0.4
run_cmd "cliclick m:803,562"            "MOVE(803,562)"
sleep 0.4
run_cmd "cliclick m:793,590"            "MOVE(793,590)"
sleep 0.4
run_cmd "cliclick c:793,591"            "CLICK(793,591)"
sleep 0.6
run_cmd "cliclick c:797,583"            "CLICK(797,583)"
sleep 0.6
run_cmd "cliclick m:723,589"            "MOVE(723,589)"
sleep 0.4
run_cmd "cliclick m:633,590"            "MOVE(633,590)"
sleep 0.4
run_cmd "cliclick m:558,594"            "MOVE(558,594)"
sleep 0.4
run_cmd "cliclick m:496,597"            "MOVE(496,597)"
sleep 0.4
run_cmd "cliclick m:474,596"            "MOVE(474,596)"
sleep 0.4
run_cmd "cliclick m:455,584"            "MOVE(455,584)"
sleep 0.4
run_cmd "cliclick m:438,594"            "MOVE(438,594)"
sleep 0.4
run_cmd "cliclick m:420,611"            "MOVE(420,611)"
sleep 0.4
run_cmd "cliclick m:281,474"            "MOVE(281,474)"
sleep 0.4
run_cmd "cliclick m:330,487"            "MOVE(330,487)"
sleep 0.4
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "cliclick c:332,488"            "CLICK(332,488)"
sleep 0.6
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "cliclick m:336,471"            "MOVE(336,471)"
sleep 0.4
run_cmd "cliclick c:336,471"            "CLICK(336,471)"
sleep 0.6
run_cmd "cliclick m:355,472"            "MOVE(355,472)"
sleep 0.4
run_cmd "cliclick m:396,470"            "MOVE(396,470)"
sleep 0.4
run_cmd "cliclick m:460,469"            "MOVE(460,469)"
sleep 0.4
run_cmd "cliclick m:558,471"            "MOVE(558,471)"
sleep 0.4
run_cmd "cliclick m:612,473"            "MOVE(612,473)"
sleep 0.4
run_cmd "cliclick m:709,474"            "MOVE(709,474)"
sleep 0.4
run_cmd "cliclick m:729,474"            "MOVE(729,474)"
sleep 0.4
run_cmd "cliclick m:774,469"            "MOVE(774,469)"
sleep 0.4
run_cmd "cliclick m:890,472"            "MOVE(890,472)"
sleep 0.4
run_cmd "cliclick m:1018,453"           "MOVE(1018,453)"
sleep 0.4
run_cmd "cliclick m:1056,443"           "MOVE(1056,443)"
sleep 0.4
run_cmd "cliclick m:1083,431"           "MOVE(1083,431)"
sleep 0.4
run_cmd "cliclick m:1142,409"           "MOVE(1142,409)"
sleep 0.4
run_cmd "cliclick m:1176,395"           "MOVE(1176,395)"
sleep 0.4
run_cmd "cliclick m:1192,385"           "MOVE(1192,385)"
sleep 0.4
run_cmd "cliclick m:1227,366"           "MOVE(1227,366)"
sleep 0.4
run_cmd "cliclick c:1232,360"           "CLICK(1232,360)"
sleep 0.6
run_cmd "cliclick m:1206,370"           "MOVE(1206,370)"
sleep 0.4
run_cmd "cliclick m:1043,430"           "MOVE(1043,430)"
sleep 0.4
run_cmd "cliclick m:1003,454"           "MOVE(1003,454)"
sleep 0.4
run_cmd "cliclick m:920,498"            "MOVE(920,498)"
sleep 0.4
run_cmd "cliclick m:860,526"            "MOVE(860,526)"
sleep 0.4
run_cmd "cliclick m:841,536"            "MOVE(841,536)"
sleep 0.4
run_cmd "cliclick m:825,553"            "MOVE(825,553)"
sleep 0.4
run_cmd "cliclick m:806,574"            "MOVE(806,574)"
sleep 0.4
run_cmd "cliclick c:790,588"            "CLICK(790,588)"
sleep 0.6
run_cmd "cliclick m:732,586"            "MOVE(732,586)"
sleep 0.4
run_cmd "cliclick m:584,577"            "MOVE(584,577)"
sleep 0.4
run_cmd "cliclick m:558,576"            "MOVE(558,576)"
sleep 0.4
run_cmd "cliclick m:464,570"            "MOVE(464,570)"
sleep 0.4
run_cmd "cliclick m:419,567"            "MOVE(419,567)"
sleep 0.4
run_cmd "cliclick c:417,567"            "CLICK(417,567)"
sleep 0.6
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "python3 -c \"from Quartz import *;e=CGEventCreateScrollWheelEvent(None,kCGScrollEventUnitLine,1,-3);CGEventPost(kCGHIDEventTap,e)\"" "SCROLL_DOWN(3)"
sleep 0.3
run_cmd "cliclick m:540,567"            "MOVE(540,567)"
sleep 0.4
run_cmd "cliclick m:650,560"            "MOVE(650,560)"
sleep 0.4
run_cmd "cliclick m:915,549"            "MOVE(915,549)"
sleep 0.4
run_cmd "cliclick m:1028,542"           "MOVE(1028,542)"
sleep 0.4
run_cmd "cliclick m:1072,532"           "MOVE(1072,532)"
sleep 0.4
run_cmd "cliclick m:1127,509"           "MOVE(1127,509)"
sleep 0.4
run_cmd "cliclick m:1166,481"           "MOVE(1166,481)"
sleep 0.4
run_cmd "cliclick m:1207,442"           "MOVE(1207,442)"
sleep 0.4
run_cmd "cliclick m:1219,421"           "MOVE(1219,421)"
sleep 0.4
run_cmd "cliclick m:1225,405"           "MOVE(1225,405)"
sleep 0.4
run_cmd "cliclick m:1233,379"           "MOVE(1233,379)"
sleep 0.4
run_cmd "cliclick m:1236,363"           "MOVE(1236,363)"
sleep 0.4
run_cmd "cliclick c:1236,363"           "CLICK(1236,363)"
sleep 0.6
run_cmd "cliclick m:1148,396"           "MOVE(1148,396)"
sleep 0.4
run_cmd "cliclick m:1005,449"           "MOVE(1005,449)"
sleep 0.4
run_cmd "cliclick m:881,502"            "MOVE(881,502)"
sleep 0.4
run_cmd "cliclick m:833,536"            "MOVE(833,536)"
sleep 0.4
run_cmd "cliclick m:804,581"            "MOVE(804,581)"
sleep 0.4
run_cmd "cliclick m:798,597"            "MOVE(798,597)"
sleep 0.4
run_cmd "cliclick c:800,593"            "CLICK(800,593)"
sleep 0.6

echo "" | tee -a "$LOG"
echo "=== REPLAY COMPLETE: $(date) ===" | tee -a "$LOG"
echo "Total executed: $STEP / $TOTAL" | tee -a "$LOG"
echo "Log saved to: $LOG" | tee -a "$LOG"
