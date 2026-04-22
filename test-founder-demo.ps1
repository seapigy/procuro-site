# Founder Demo Test Script
# Tests all backend endpoints for the demo flow

$baseUrl = "http://localhost:5000"
$frontendUrl = "http://localhost:5173"

Write-Host "╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🎯 PROCURO FOUNDER DEMO TEST            ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Function to test an endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "  → $Method $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = @{
                "Content-Type" = "application/json"
            }
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-WebRequest @params
        $statusCode = $response.StatusCode
        
        if ($statusCode -ge 200 -and $statusCode -lt 300) {
            $content = $response.Content | ConvertFrom-Json
            Write-Host "  ✅ Success ($statusCode)" -ForegroundColor Green
            if ($content.PSObject.Properties.Name.Count -le 5) {
                Write-Host "  Response: $($content | ConvertTo-Json -Compress)" -ForegroundColor Gray
            }
            return @{ Success = $true; Data = $content }
        } else {
            Write-Host "  ❌ Failed ($statusCode)" -ForegroundColor Red
            return @{ Success = $false; StatusCode = $statusCode }
        }
    } catch {
        Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# Wait for server to be ready
Write-Host "Waiting for backend server to start..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts -and -not $serverReady) {
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
            Write-Host "✅ Backend server is ready!" -ForegroundColor Green
        }
    } catch {
        $attempt++
        Start-Sleep -Seconds 1
        Write-Host "  Attempt $attempt/$maxAttempts..." -ForegroundColor Gray
    }
}

if (-not $serverReady) {
    Write-Host "❌ Backend server did not start in time. Please start it manually:" -ForegroundColor Red
    Write-Host "   cd server && TEST_MODE=true npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "PHASE 1: VERIFY SERVER STATUS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Test health endpoint
Test-Endpoint "Health Check" "$baseUrl/health"

# Test test mode status
$testStatus = Test-Endpoint "Test Mode Status" "$baseUrl/api/test/status"
Write-Host ""

if ($testStatus.Success -and $testStatus.Data.testMode) {
    Write-Host "✅ TEST_MODE is enabled" -ForegroundColor Green
} else {
    Write-Host "⚠️  TEST_MODE may not be enabled. Set TEST_MODE=true in environment" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "PHASE 2: TEST ADMIN SETUP" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Step 1: Setup test environment
Write-Host "Step 1: Setup Test Company / User" -ForegroundColor Magenta
$setupResult = Test-Endpoint "Setup Test Environment" "$baseUrl/api/test/setup" "POST"
Write-Host ""

if ($setupResult.Success) {
    Write-Host "  Company: $($setupResult.Data.company.name) (ID: $($setupResult.Data.company.id))" -ForegroundColor Green
    Write-Host "  User: $($setupResult.Data.user.email)" -ForegroundColor Green
}

# Step 2: Import sample data
Write-Host "Step 2: Import Sample Data" -ForegroundColor Magenta
$importResult = Test-Endpoint "Import Sample QBO Data" "$baseUrl/api/test/import-sample-data" "POST"
Write-Host ""

if ($importResult.Success) {
    Write-Host "  Items created: $($importResult.Data.itemsCreated)" -ForegroundColor Green
    Write-Host "  Items updated: $($importResult.Data.itemsUpdated)" -ForegroundColor Green
    Write-Host "  Total items: $($importResult.Data.totalItems)" -ForegroundColor Green
    Write-Host "  Monitored items: $($importResult.Data.monitoredItems)" -ForegroundColor Green
}

# Step 3: Force subscribe
Write-Host "Step 3: Force Subscribe" -ForegroundColor Magenta
$subscribeResult = Test-Endpoint "Force Subscribe" "$baseUrl/api/test/force-subscribe" "POST"
Write-Host ""

if ($subscribeResult.Success) {
    Write-Host "  Subscription activated: $($subscribeResult.Data.company.isSubscribed)" -ForegroundColor Green
}

# Step 4: Recompute monitoring
Write-Host "Step 4: Recompute Monitoring" -ForegroundColor Magenta
$recomputeResult = Test-Endpoint "Recompute Monitoring" "$baseUrl/api/test/recompute-monitoring" "POST"
Write-Host ""

if ($recomputeResult.Success) {
    Write-Host "  Monitored items: $($recomputeResult.Data.monitoredItems)" -ForegroundColor Green
}

# Step 5: Run price check
Write-Host "Step 5: Run Price Check" -ForegroundColor Magenta
$priceCheckResult = Test-Endpoint "Run Price Check" "$baseUrl/api/test/run-price-check" "POST"
Write-Host ""

if ($priceCheckResult.Success) {
    Write-Host "  Total alerts: $($priceCheckResult.Data.alertsCount)" -ForegroundColor Green
    if ($priceCheckResult.Data.simulatedAlertsCreated) {
        Write-Host "  New alerts created: $($priceCheckResult.Data.simulatedAlertsCreated)" -ForegroundColor Green
    }
    if ($priceCheckResult.Data.recentAlerts -and $priceCheckResult.Data.recentAlerts.Count -gt 0) {
        Write-Host "  Recent alerts:" -ForegroundColor Green
        $priceCheckResult.Data.recentAlerts | ForEach-Object {
            Write-Host "    - $($_.itemName): $($_.oldPrice) → $($_.newPrice) (Save: `$$($_.savingsPerOrder))" -ForegroundColor Gray
        }
    }
}

# Get final status
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "FINAL STATUS CHECK" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$finalStatus = Test-Endpoint "Final Status Check" "$baseUrl/api/test/status"
Write-Host ""

if ($finalStatus.Success -and $finalStatus.Data.company) {
    $company = $finalStatus.Data.company
    Write-Host "Company Status:" -ForegroundColor Cyan
    Write-Host "  Name: $($company.name)" -ForegroundColor White
    Write-Host "  ID: $($company.id)" -ForegroundColor White
    Write-Host "  Subscribed: $($company.isSubscribed)" -ForegroundColor $(if ($company.isSubscribed) { "Green" } else { "Yellow" })
    Write-Host "  Monitored Items: $($company.monitoredItemsCount)" -ForegroundColor White
    Write-Host "  Users: $($company.userCount)" -ForegroundColor White
    if ($company.lastAlertGenerated) {
        $alertDate = [DateTime]::Parse($company.lastAlertGenerated)
        Write-Host "  Last Alert: $($alertDate.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
    } else {
        Write-Host "  Last Alert: None" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "NEXT STEPS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Backend API tests complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Now test the frontend manually:" -ForegroundColor Yellow
Write-Host "1. Open browser: $frontendUrl" -ForegroundColor White
Write-Host "2. Navigate to: $frontendUrl/test-admin" -ForegroundColor White
Write-Host "3. Verify all buttons work" -ForegroundColor White
Write-Host "4. Test Dashboard: $frontendUrl/dashboard" -ForegroundColor White
Write-Host "5. Test Items: $frontendUrl/items" -ForegroundColor White
Write-Host "6. Test Reports: $frontendUrl/reports" -ForegroundColor White
Write-Host "7. Test Settings: $frontendUrl/settings" -ForegroundColor White
Write-Host ""
Write-Host "For subscription gating test:" -ForegroundColor Yellow
Write-Host "1. Go to /test-admin and click Force Unsubscribe" -ForegroundColor White
Write-Host "2. Check Dashboard for upgrade banners" -ForegroundColor White
Write-Host "3. Verify Check Price Now is disabled" -ForegroundColor White
Write-Host "4. Check Reports for upgrade prompts" -ForegroundColor White
Write-Host "5. Check Settings for subscription status" -ForegroundColor White
Write-Host ""

