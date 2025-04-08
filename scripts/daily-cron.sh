#!/bin/bash

cd /home/site/wwwroot

echo ">>> Running listing import..."
node scripts/daily-import-listings.js >> /home/LogFiles/listing-cron.log 2>&1

echo ">>> Running violation match..."
node scripts/match-violations.js >> /home/LogFiles/match-cron.log 2>&1
