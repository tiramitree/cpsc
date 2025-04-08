#!/bin/bash

cd /home/site/wwwroot

echo ">>> Running violation match..."
node scripts/match-violations.js >> /home/LogFiles/match-cron.log 2>&1
