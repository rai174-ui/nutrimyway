$BASE = "https://nutrimyway-production.up.railway.app/api"
$CENTER_ID = "center_dwarka_club"   # <-- change if different

# Step 1: Login to get a token
Write-Host "`n=== Step 1: Admin Login ===" -ForegroundColor Cyan
Write-Host "Enter your admin password:" -ForegroundColor Yellow
$PASSWORD = Read-Host

try {
    $loginBody = @{ center_id = $CENTER_ID; password = $PASSWORD } | ConvertTo-Json
    $loginResp = Invoke-RestMethod -Uri "$BASE/admin/login" -Method POST -ContentType "application/json" -Body $loginBody
    $TOKEN = $loginResp.token
    Write-Host "Login SUCCESS. Token received." -ForegroundColor Green
} catch {
    Write-Host "Login FAILED: $_" -ForegroundColor Red
    exit 1
}

$HEADERS = @{ Authorization = "Bearer $TOKEN" }

# Step 2: Check push tokens in DB
Write-Host "`n=== Step 2: Checking Members with Push Tokens ===" -ForegroundColor Cyan
try {
    $membersResp = Invoke-RestMethod -Uri "$BASE/admin/centers/$CENTER_ID/members" -Method GET -Headers $HEADERS
    $members = $membersResp.members
    $withToken = $members | Where-Object { $_.push_token -ne $null -and $_.push_token -ne "" }
    Write-Host "Total members: $($members.Count)" -ForegroundColor White
    Write-Host "Members WITH push token: $($withToken.Count)" -ForegroundColor $(if ($withToken.Count -gt 0) { "Green" } else { "Red" })
    if ($withToken.Count -gt 0) {
        foreach ($m in $withToken) {
            Write-Host "  - $($m.name) | token: $($m.push_token.Substring(0, [Math]::Min(30, $m.push_token.Length)))..." -ForegroundColor Green
        }
    } else {
        Write-Host "  No push tokens found! Members need to open the new APK first." -ForegroundColor Red
    }
} catch {
    Write-Host "Failed to fetch members: $_" -ForegroundColor Red
}

# Step 3: Send test broadcast
Write-Host "`n=== Step 3: Sending Test Broadcast ===" -ForegroundColor Cyan
try {
    $broadcastBody = @{ message = "TEST: Push notification diagnostic $(Get-Date -Format 'HH:mm:ss')" } | ConvertTo-Json
    $broadcastResp = Invoke-RestMethod -Uri "$BASE/admin/centers/$CENTER_ID/broadcasts" -Method POST -ContentType "application/json" -Headers $HEADERS -Body $broadcastBody
    Write-Host "Broadcast sent! ID: $($broadcastResp.id)" -ForegroundColor Green
    Write-Host "Message: $($broadcastResp.message)" -ForegroundColor White
    Write-Host "`nNow check your phone for a system notification within 30 seconds." -ForegroundColor Yellow
} catch {
    Write-Host "Broadcast FAILED: $_" -ForegroundColor Red
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
