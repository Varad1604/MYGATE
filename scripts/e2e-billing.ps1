# SocietyOS E2E — Billing & payments (Phase 5)
$ErrorActionPreference = "Stop"
$api = "http://localhost:4000/api/v1"

function PostJson($uri, $body, $token) {
  $h = @{}
  if ($token) { $h.Authorization = "Bearer $token" }
  Invoke-RestMethod -Method Post -Uri $uri -Headers $h -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 6)
}
function GetJson($uri, $token) {
  Invoke-RestMethod -Method Get -Uri $uri -Headers @{ Authorization = "Bearer $token" }
}

$admin = PostJson "$api/auth/login" @{ identifier = "admin@greenview.test"; password = "Demo#Pass1" }
$atok = $admin.accessToken
$cid = $admin.context.communityId
Write-Host "1. admin logged in ($($cid.Substring(0,8)))"

$heads = GetJson "$api/communities/$cid/billing/charge-heads" $atok
$maint = $heads | Where-Object name -eq "Maintenance Dues" | Select-Object -First 1
if (-not $maint) { throw "Maintenance charge head missing from seed" }
Write-Host "2. charge heads available: $($heads.Count) (using '$($maint.name)', $($maint.calcMethod))"

$run = PostJson "$api/communities/$cid/billing/bill-runs" @{
  name = "Monthly Maintenance E2E $(Get-Date -Format 'HHmmss')"
  frequency = "MONTHLY"
  periodLabel = "2026-08"
  dueDate = "2026-09-05T00:00:00Z"
  scope = @{ kind = "ALL_UNITS" }
  lines = @( @{ chargeHeadId = $maint.id; amountPaise = 250; description = "August maintenance @ Rs.2.50 per sqft" } )
} $atok
Write-Host "3. bill run DRAFT id=$($run.id.Substring(0,8))"

$gen = PostJson "$api/bill-runs/$($run.id)/generate" @{} $atok
if ($gen.generated -ne 36) { Write-Host "   WARN: expected 36 invoices, got $($gen.generated)" }
Write-Host "4. generated $($gen.generated) DRAFT invoices"
try {
  PostJson "$api/bill-runs/$($run.id)/generate" @{} $atok | Out-Null
  throw "RE-GENERATION OF COMPLETED RUN WAS ALLOWED!"
} catch {
  if ("$($_.ErrorDetails.Message)" -match "BILL_RUN_NOT_DRAFT") { Write-Host "5. re-generation blocked (state machine OK)" }
  else { throw }
}

# Resident login first (admin has no unit occupancy).
$null = PostJson "$api/auth/request-otp" @{ target = "anita@example.com" }
Start-Sleep -Milliseconds 800
$code = (Invoke-RestMethod "$api/__dev/last-otp?target=anita%40example.com").code
$anita = PostJson "$api/auth/verify-otp" @{ target = "anita@example.com"; code = $code }
$ratok = $anita.accessToken

$myUnits = GetJson "$api/me/units" $ratok
$unitId = $myUnits[0].unit.id
Write-Host "   resident unit: $($myUnits[0].unit.label)"
# Pick THIS run's invoice for the unit (earlier runs may have left older ones).
$invList = GetJson "$api/communities/$cid/invoices?unitId=$unitId&periodLabel=2026-08" $atok
$inv = $invList.items | Where-Object { $_.billRunId -eq $run.id } | Select-Object -First 1
# AREA_BASED math: 1450 sqft x 250 paise = 362500 paise exactly.
if ($inv.subtotalPaise -ne 362500) { Write-Host "   WARN: expected 362500, got $($inv.subtotalPaise)" }
Write-Host "6. unit invoice $($inv.reference): subtotal=$($inv.subtotalPaise) total=$($inv.totalPaise) (1450sqft x Rs2.50)"

$issued = PostJson "$api/invoices/$($inv.id)/issue" @{} $atok
if ($issued.status -ne "ISSUED") { throw "issue failed" }
Write-Host "7. invoice ISSUED"

# Resident pays exactly this invoice
$pay = PostJson "$api/me/payments/initiate" @{ invoiceIds = @($inv.id); method = "UPI" } $ratok
if ($pay.status -ne "PENDING") { throw "payment not PENDING" }
Write-Host "8. payment PENDING order=$($pay.providerOrderId.Substring(0,18)) amount=$($pay.amountPaise)"

# Build + sign the mock webhook (HMAC-SHA256 over canonical string).
$secret = "dev-mock-payment-secret"
$eventId = [guid]::NewGuid().ToString()
$type = "payment.captured"
$ppid = "mockpay_$([guid]::NewGuid().ToString('N').Substring(0,12))"
$canonical = "$eventId|$type|$($pay.providerOrderId)|$ppid|$($pay.amountPaise)"
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$sig = -join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical)) | ForEach-Object { $_.ToString("x2") })

try {
  PostJson "$api/webhooks/payments/mock" @{
    eventId = $eventId; type = $type
    providerOrderId = $pay.providerOrderId; providerPaymentId = $ppid
    amountPaise = $pay.amountPaise; signature = $sig
  } $null | Out-Null
} catch {
    throw "webhook rejected: $($_.ErrorDetails.Message)"
}
Write-Host "9. signed webhook accepted"

$after = GetJson "$api/communities/$cid/invoices?unitId=$unitId&periodLabel=2026-08" $atok
$paidInv = $after.items | Where-Object id -eq $inv.id | Select-Object -First 1
if ($paidInv.status -ne "PAID") { throw "invoice not PAID: $($paidInv.status)" }
if ($paidInv.paidPaise -ne $paidInv.totalPaise) { throw "allocation mismatch" }
Write-Host "10. invoice PAID paidPaise=$($paidInv.paidPaise) (allocation engine OK)"

$payments = GetJson "$api/units/$unitId/payments" $ratok
$pmt = $payments | Where-Object id -eq $pay.id | Select-Object -First 1
if ($pmt.status -ne "SUCCESS") { throw "payment not SUCCESS" }
if (-not $pmt.receipt.pdfFileId) { throw "receipt PDF not generated" }
Write-Host "11. receipt $($pmt.receipt.reference) with PDF generated"

# Idempotency: replay same event
$replay = PostJson "$api/webhooks/payments/mock" @{
  eventId = $eventId; type = $type
  providerOrderId = $pay.providerOrderId; providerPaymentId = $ppid
  amountPaise = $pay.amountPaise; signature = $sig
} $null
if (-not $replay.duplicate) { throw "replay was processed again!" }
Write-Host "12. replayed event treated as duplicate OK"

# Tamper: wrong signature must be rejected
$tampered = $sig.Substring(0, $sig.Length - 2) + "00"
try {
  PostJson "$api/webhooks/payments/mock" @{
    eventId = [guid]::NewGuid().ToString(); type = $type
    providerOrderId = $pay.providerOrderId; providerPaymentId = "mockpay_tamper01"
    amountPaise = $pay.amountPaise; signature = $tampered
  } $null | Out-Null
  throw "TAMPERED SIGNATURE ACCEPTED!"
} catch {
  if ("$($_.ErrorDetails.Message)" -match "signature") { Write-Host "13. tampered signature rejected OK" }
  else { throw }
}

Write-Host ""
Write-Host "ALL BILLING E2E CHECKS PASSED" -ForegroundColor Green
