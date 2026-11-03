#!/bin/bash
set +e
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null; sleep 2
setsid bash -c 'exec bun run dev >> dev.log 2>&1' < /dev/null &
sleep 14
curl -s --max-time 5 http://localhost:3000/ -o /dev/null || { echo "DOWN"; exit 1; }
agent-browser open http://localhost:3000/ 2>&1 | tail -1
agent-browser set viewport 1440 900 2>&1 | tail -1
sleep 2

# refs are stable: Dashboard=e8 Pipeline=e9 Lead=e10 DataQuality=e11 Analyst=e12
echo "===== DASHBOARD (e8) ====="
agent-browser click @e8 2>&1 | tail -1; sleep 1
agent-browser snapshot -c 2>&1 | sed -n '1,55p'

echo ""; echo "===== DATA QUALITY (e11) ====="
agent-browser click @e11 2>&1 | tail -1; sleep 1
agent-browser snapshot -c 2>&1 | sed -n '1,45p'

echo ""; echo "===== AI ANALYST (e12) ====="
agent-browser click @e12 2>&1 | tail -1; sleep 1
agent-browser snapshot -c 2>&1 | sed -n '1,40p'

echo ""; echo "===== ASK OVERDUE QUESTION ====="
# example chips are buttons; find the overdue chip by text
agent-browser find text "Which deals are overdue?" click 2>&1 | tail -1
sleep 4
agent-browser snapshot -c 2>&1 | sed -n '1,50p'

echo ""; echo "===== LEAD DETAIL (e10) + EMAIL ====="
agent-browser click @e10 2>&1 | tail -1; sleep 1
agent-browser snapshot -c 2>&1 | sed -n '1,30p'
agent-browser find text "Generate follow-up email" click 2>&1 | tail -1
sleep 6
agent-browser snapshot -c 2>&1 | sed -n '1,40p'

echo ""; echo "===== CONSOLE ERRORS ====="
agent-browser errors 2>&1 | tail -12
agent-browser close 2>&1 | tail -1
echo "=== DONE ==="
