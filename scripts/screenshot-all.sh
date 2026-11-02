#!/bin/bash
# Start dev server + screenshot all BIAI screens in one session.
set +e
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
sleep 2

# start dev server detached in this same shell's process tree
setsid bash -c 'exec bun run dev >> dev.log 2>&1' < /dev/null &
echo "dev server starting..."
sleep 14

# confirm up
if ! curl -s --max-time 5 http://localhost:3000/ -o /dev/null; then
  echo "SERVER NOT UP — aborting"
  exit 1
fi
echo "server up"

mkdir -p /tmp/biai-shots
agent-browser open http://localhost:3000/ 2>&1 | tail -2
agent-browser set viewport 1440 900 2>&1 | tail -1
sleep 2

# Dashboard (default view)
agent-browser screenshot /tmp/biai-shots/01-dashboard.png 2>&1 | tail -1
echo "shot 1 done"

# Pipeline
agent-browser snapshot -i 2>&1 | grep -iE "pipeline|dashboard|lead|data|analyst" | head -8
NAV_REF=$(agent-browser snapshot -i 2>&1 | grep -i "Pipeline" | grep -oE '@e[0-9]+' | head -1)
echo "pipeline nav ref: $NAV_REF"
if [ -n "$NAV_REF" ]; then agent-browser click $NAV_REF 2>&1 | tail -1; fi
sleep 1
agent-browser screenshot /tmp/biai-shots/02-pipeline.png 2>&1 | tail -1
echo "shot 2 done"

# Lead Details — click first lead row
agent-browser snapshot -i 2>&1 | grep -iE "L0[0-9]" | head -3
LEAD_REF=$(agent-browser snapshot -i 2>&1 | grep -oE 'L0[0-9]' | head -1)
echo "clicking lead: $LEAD_REF"
# click the row containing L01
agent-browser find text "L01" click 2>&1 | tail -1 || agent-browser eval "document.querySelector('tbody tr')?.click()" 2>&1 | tail -1
sleep 2
agent-browser screenshot /tmp/biai-shots/03-lead-detail.png 2>&1 | tail -1
echo "shot 3 done"

# Data Quality
agent-browser find text "Data Quality" click 2>&1 | tail -1
sleep 1
agent-browser screenshot /tmp/biai-shots/04-data-quality.png 2>&1 | tail -1
echo "shot 4 done"

# AI Analyst
agent-browser find text "AI Analyst" click 2>&1 | tail -1
sleep 1
agent-browser screenshot /tmp/biai-shots/05-analyst.png 2>&1 | tail -1
echo "shot 5 done"

# Test AI analyst with a question
agent-browser find text "Which deals are overdue?" click 2>&1 | tail -1
sleep 4
agent-browser screenshot /tmp/biai-shots/06-analyst-result.png 2>&1 | tail -1
echo "shot 6 done"

# Test email generation on lead detail
agent-browser find text "Lead Details" click 2>&1 | tail -1
sleep 1
agent-browser find text "Generate follow-up email" click 2>&1 | tail -1
sleep 6
agent-browser screenshot /tmp/biai-shots/07-email-generated.png 2>&1 | tail -1
echo "shot 7 done"

agent-browser close 2>&1 | tail -1
echo "=== ALL SHOTS ==="
ls -la /tmp/biai-shots/
echo "=== errors ==="
agent-browser errors 2>&1 | tail -10
