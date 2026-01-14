#!/bin/bash
# keep-awake.sh - Prevents Mac from sleeping
# Run: ./keep-awake.sh
# Press Ctrl+C to stop

echo "Keeping screen awake. Press Ctrl+C to stop..."

# caffeinate -d prevents display sleep
# caffeinate -i prevents idle sleep
# The process runs until Ctrl+C is pressed
caffeinate -di
