# keep-awake.ps1 - Prevents Windows from sleeping for a set duration
# Run: powershell -ExecutionPolicy Bypass -File keep-awake.ps1
# Optional: powershell -ExecutionPolicy Bypass -File keep-awake.ps1 -Hours 5

param(
    [double]$Hours = 10
)

$endTime = (Get-Date).AddHours($Hours)

Write-Host "Keeping screen awake until $($endTime.ToString('h:mm tt'))" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop early..." -ForegroundColor Gray

# Load the SetThreadExecutionState function
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class PowerState {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);

    public const uint ES_CONTINUOUS = 0x80000000;
    public const uint ES_DISPLAY_REQUIRED = 0x00000002;
    public const uint ES_SYSTEM_REQUIRED = 0x00000001;
}
"@

try {
    while ((Get-Date) -lt $endTime) {
        # Prevent display and system sleep
        [PowerState]::SetThreadExecutionState(
            [PowerState]::ES_CONTINUOUS -bor
            [PowerState]::ES_DISPLAY_REQUIRED -bor
            [PowerState]::ES_SYSTEM_REQUIRED
        ) | Out-Null

        # Calculate remaining time
        $remaining = $endTime - (Get-Date)
        $remainingStr = "{0}h {1}m remaining" -f [int]$remaining.TotalHours, $remaining.Minutes
        Write-Host "`r$remainingStr    " -NoNewline

        Start-Sleep -Seconds 30
    }
    Write-Host "`nTime's up!" -ForegroundColor Cyan
}
finally {
    # Restore normal power state on exit
    [PowerState]::SetThreadExecutionState([PowerState]::ES_CONTINUOUS) | Out-Null
    Write-Host "Power state restored." -ForegroundColor Yellow
}
