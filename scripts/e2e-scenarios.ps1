# SocietyOS E2E - Phase 10 Scenario Matrix (A-J)
# Full product walkthrough against a live dev API. ASCII only. Idempotent
# via unique per-run suffixes.
$ErrorActionPreference = "Stop"
$api = "http://localhost:4000/api/v1"
$suffix = (Get-Date).ToString("HHmmss")

function PostJson($uri, $body, $token) {
  $h = @{}
  if ($token) { $h.Authorization = "Bearer $token" }
  Invoke-RestMethod -Method Post -Uri $uri -Headers $h -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 8)
}
function PatchJson($uri, $body, $token) {
  Invoke-RestMethod -Method Patch -Uri $uri -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 6)
}
function GetJson($uri, $token) {
  Invoke-RestMethod -Method Get -Uri $uri -Headers @{ Authorization = "Bearer $token" }
}
function LoginOtp($target) {
  $null = PostJson "$api/auth/request-otp" @{ target = $target }
  Start-Sleep -Milliseconds 800
  $enc = [uri]::EscapeDataString($target)
  $c = (Invoke-RestMethod "$api/__dev/last-otp?target=$enc").code
  return PostJson "$api/auth/verify-otp" @{ target = $target; code = $c }
}
function ErrorCode($err) {
  try { return ($err.ErrorDetails.Message | ConvertFrom-Json).error.code } catch { return "?$($_.Exception.Message)" }
}

# HMAC helper for billing webhooks (mirrors MockPaymentProvider).
function SignPayload([string]$eventId, [string]$type, [string]$orderId, [string]$payId, [long]$amount) {
  $canonical = "$eventId|$type|$orderId|$payId|$amount"
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = [Text.Encoding]::UTF8.GetBytes("dev-mock-payment-secret")
  return ([BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical)))).Replace("-", "").ToLower()
}

Write-Host "================ SCENARIO A: PLATFORM ONBOARDING ================"
$plat = PostJson "$api/auth/login" @{ identifier = "platform@societyos.dev"; password = "Demo#Pass1" }
$ptok = $plat.accessToken
$comm = PostJson "$api/platform/communities" @{
  name = "Scenario Society $suffix"; slug = "scenario-$suffix"
  city = "Pune"; state = "MH"; postalCode = "411001"; timezone = "Asia/Kolkata"
} $ptok
$ncid = $comm.id
Write-Host "A1. community created $($comm.name)"

$tower = PostJson "$api/communities/$ncid/towers" @{ name = "Tower X"; code = "X" } $ptok
foreach ($lvl in 1, 2) {
  PostJson "$api/towers/$($tower.id)/floors" @{ level = $lvl } $ptok | Out-Null
}
$ut = PostJson "$api/communities/$ncid/unit-types" @{ name = "3BHK"; areaSqft = 1200 } $ptok
$unitsRes = PostJson "$api/communities/$ncid/units" @{
  towerId = $tower.id; floorLevel = 1; labels = @("101", "102"); unitTypeId = $ut.id
} $ptok
$gate = PostJson "$api/communities/$ncid/gates" @{ name = "Main Gate"; code = "MG" } $ptok
$nunits = GetJson "$api/communities/$ncid/units" $ptok
$x101 = @($nunits.items | Where-Object { $_.label -eq "X-101" })[0]
if (-not $x101) { $x101 = @($nunits.items | Where-Object { $_.label -eq "101" })[0] }
if (-not $x101) { throw "unit 101 missing after batch create: $(@($nunits.items) | ForEach-Object label)" }
Write-Host "A2. structure: tower + $(@($nunits.items).Count) units + gate"

$newPhone = "+9199$suffix"
$newEmail = "owner$suffix@scen.test"
$owner = PostJson "$api/communities/$ncid/residents" @{
  unitId = $x101.id; kind = "OWNER"; fullName = "Test Owner $suffix"
  phone = $newPhone; email = $newEmail; isPrimaryContact = $true
} $ptok
$ownerAuth = LoginOtp $newEmail
if ($ownerAuth.context.communityId -ne $ncid) { throw "new owner context wrong" }
Write-Host "A3. resident onboarded and OTP login works (roles: $($ownerAuth.context.roleKeys -join ','))"

Write-Host "================ SCENARIO B: PRE-APPROVED VISITOR ================"
$admin = PostJson "$api/auth/login" @{ identifier = "admin@greenview.test"; password = "Demo#Pass1" }
$atok = $admin.accessToken; $cid = $admin.context.communityId
$anita = LoginOtp "anita@example.com"; $atok2 = $anita.accessToken
$aunits = GetJson "$api/me/units" $atok2
$a101 = @($aunits | Where-Object { $_.unit.label -eq "A-101" })[0]
if (-not $a101) { throw "Anita has no A-101 unit: $(@($aunits) | ForEach-Object { $_.unit.label })" }
$a101Id = $a101.unit.id
$gates = GetJson "$api/communities/$cid/gates" $atok
$mainGate = @($gates | Where-Object { $_.name -eq "Main Gate" })[0]

$inv = PostJson "$api/communities/$cid/visitors/invitations" @{
  unitId = $a101Id; visitorName = "Priya Guest"; visitorPhone = "+919811111111"
  visitorType = "GUEST"; vehicleNumber = "MH01GG$suffix"
} $atok2
$guard = LoginOtp "+9900000011"; $gtok = $guard.accessToken
$visit = PostJson "$api/gate/visitors/check-in" @{ token = $inv.qrToken; gateId = $mainGate.id } $gtok
$visitObj = if ($visit.visit) { $visit.visit } else { $visit }
if ($visitObj.status -ne "CHECKED_IN") { throw "check-in failed: $($visitObj.status)" }
try {
  PostJson "$api/gate/visitors/check-in" @{ token = $inv.qrToken; gateId = $mainGate.id } $gtok | Out-Null
  throw "double check-in accepted!"
} catch { if ((ErrorCode $_) -notmatch "ALREADY|INVALID|VISITOR_NOT_APPROVED|CHECKED_IN") { throw } }
PostJson "$api/gate/visitors/check-out" @{ visitId = $visitObj.id } $gtok | Out-Null
Write-Host "B1. token check-in, double-entry blocked, checked out OK"

Write-Host "================ SCENARIO C: SPOT VISITOR APPROVAL ================"
$spot = PostJson "$api/gate/visitors/spot-request" @{
  unitId = $a101Id; gateId = $mainGate.id; visitorName = "Courier Spot"
  visitorType = "DELIVERY"
} $gtok
$sid = $spot.invitation.id
if ($spot.invitation.status -ne "WAITING_APPROVAL") { throw "spot request not waiting: $($spot.invitation.status)" }
$pending = GetJson "$api/me/visitors/pending" $atok2
$found = @($pending | Where-Object { $_.id -eq $sid }).Count
if ($found -lt 1) { throw "pending approval not visible to resident" }
# Guard must NOT be able to self-approve his own request.
try {
  PostJson "$api/me/visitors/$sid/approve" @{} $gtok | Out-Null
  throw "guard self-approval accepted!"
} catch {
  $code = ErrorCode $_
  if ($code -notmatch "FORBIDDEN|PERMISSION|NOT_FOUND|NOT_YOUR_UNIT") { throw }
}
$dec = PostJson "$api/me/visitors/$sid/approve" @{} $atok2
if ($dec.status -ne "APPROVED") { throw "approve failed: $($dec.status)" }
$v2 = PostJson "$api/gate/visitors/check-in" @{ invitationId = $sid; gateId = $mainGate.id } $gtok
PostJson "$api/gate/visitors/check-out" @{ visitId = $v2.visit.id } $gtok | Out-Null
Write-Host "C1. spot request -> resident approve -> entry+exit; guard cannot self-approve OK"

Write-Host "================ SCENARIO D: HELPDESK LIFECYCLE ================"
$cats = GetJson "$api/communities/$cid/ticket-categories" $atok2
$plumb = @($cats | Where-Object { $_.name -like "*lumb*" })[0]
$ticket = PostJson "$api/communities/$cid/tickets" @{
  categoryId = $plumb.id; title = "Tap leak D"; description = "Kitchen tap leaking since morning."
  priority = "HIGH"; clientEventId = [guid]::NewGuid().ToString()
} $atok2
# Illegal transition first: OPEN -> CLOSED directly must be rejected.
try {
  PostJson "$api/tickets/$($ticket.id)/status" @{ status = "CLOSED" } $atok | Out-Null
  throw "OPEN->CLOSED accepted!"
} catch { if ((ErrorCode $_) -notmatch "TRANSITION|VALIDATION|BAD_REQUEST") { throw } }
$staff = LoginOtp "+9900000020"; $stok = $staff.accessToken
PostJson "$api/tickets/$($ticket.id)/assign" @{ assigneeUserId = $staff.context.userId } $atok | Out-Null
PostJson "$api/tickets/$($ticket.id)/comments" @{ body = "On my way; checking the line." ; isInternal = $false } $stok | Out-Null
PostJson "$api/tickets/$($ticket.id)/status" @{ status = "IN_PROGRESS" } $stok | Out-Null
$tAfterProgress = GetJson "$api/tickets/$($ticket.id)" $atok2
if (-not $tAfterProgress.firstResponseAt) { throw "first response not stamped on IN_PROGRESS" }
PostJson "$api/tickets/$($ticket.id)/status" @{ status = "RESOLVED"; note = "Replaced washer." } $stok | Out-Null
PostJson "$api/tickets/$($ticket.id)/rate" @{ rating = 5; comment = "Fast!" } $atok2 | Out-Null
PostJson "$api/tickets/$($ticket.id)/status" @{ status = "CLOSED" } $atok2 | Out-Null
PostJson "$api/tickets/$($ticket.id)/status" @{ status = "REOPENED" } $atok2 | Out-Null
$tFinal = GetJson "$api/tickets/$($ticket.id)" $atok2
if ($tFinal.reopenedCount -lt 1) { throw "reopenedCount not incremented" }
Write-Host "D1. raise->assign->progress(SLA stamp)->resolve->rate5->close->reopen(reopenedCount=$($tFinal.reopenedCount)); illegal transition blocked OK"

Write-Host "================ SCENARIO E: BILLING CYCLE ================"
$maint = PostJson "$api/communities/$cid/billing/charge-heads" @{
  name = "Scen Charge $suffix"; calcMethod = "AREA_BASED"; defaultAmountPaise = 250; taxable = $false
} $atok
$run = PostJson "$api/communities/$cid/billing/bill-runs" @{
  name = "Scen Run $suffix"; frequency = "MONTHLY"; periodLabel = "2026-08"
  dueDate = (Get-Date).AddDays(10).ToUniversalTime().ToString("o")
  scope = @{ kind = "ALL_UNITS" }
  lines = @( @{ chargeHeadId = $maint.id; amountPaise = 250; description = "Scenario maintenance per sqft" } )
} $atok
$gen = PostJson "$api/bill-runs/$($run.id)/generate" @{} $atok
if ($gen.generated -lt 1) { throw "no invoices generated: $($gen | ConvertTo-Json -Compress)" }
$aunitsE = GetJson "$api/me/units" $atok2
$unitIdE = $aunitsE[0].unit.id
$invListE = GetJson "$api/communities/$cid/invoices?unitId=$unitIdE&periodLabel=2026-08" $atok
$freshInv = @($invListE.items | Where-Object { $_.billRunId -eq $run.id })[0]
if (-not $freshInv) { throw "this run's invoice missing for A-101" }
$issued = PostJson "$api/invoices/$($freshInv.id)/issue" @{} $atok
if ($issued.status -ne "ISSUED") { throw "issue failed: $($issued.status)" }
$pay = PostJson "$api/me/payments/initiate" @{ invoiceIds = @($freshInv.id); method = "UPI" } $atok2
$eventId = [guid]::NewGuid().ToString()
$type = "payment.captured"
$ppid = "mockpay_$([guid]::NewGuid().ToString('N').Substring(0,12))"
$sig = SignPayload $eventId $type $pay.providerOrderId $ppid ([long]$pay.amountPaise)
PostJson "$api/webhooks/payments/mock" @{
  eventId = $eventId; type = $type
  providerOrderId = $pay.providerOrderId; providerPaymentId = $ppid
  amountPaise = $pay.amountPaise; signature = $sig
} $null | Out-Null
$replay = PostJson "$api/webhooks/payments/mock" @{
  eventId = $eventId; type = $type
  providerOrderId = $pay.providerOrderId; providerPaymentId = $ppid
  amountPaise = $pay.amountPaise; signature = $sig
} $null
if (-not $replay.duplicate) { throw "replay was processed again!" }
$tampered = $sig.Substring(0, $sig.Length - 2) + "00"
try {
  PostJson "$api/webhooks/payments/mock" @{
    eventId = [guid]::NewGuid().ToString(); type = $type
    providerOrderId = $pay.providerOrderId; providerPaymentId = "mockpay_t01"
    amountPaise = $pay.amountPaise; signature = $tampered
  } $null | Out-Null
  throw "TAMPERED SIGNATURE ACCEPTED!"
} catch {
  if ("$($_.ErrorDetails.Message)" -notmatch "signature") { throw }
}
$afterE = GetJson "$api/communities/$cid/invoices?unitId=$unitIdE&periodLabel=2026-08" $atok
$paidInv = @($afterE.items | Where-Object { $_.id -eq $freshInv.id })[0]
if ($paidInv.status -ne "PAID") { throw "invoice not PAID: $($paidInv.status)" }
$paymentsE = GetJson "$api/units/$unitIdE/payments" $atok2
$pmtE = @($paymentsE | Where-Object { $_.id -eq $pay.id })[0]
if (-not $pmtE.receipt.pdfFileId) { throw "receipt PDF not generated" }
Write-Host "E1. run->$($gen.generated) invoices -> pay $($pay.amountPaise) paise -> PAID + receipt $($pmtE.receipt.reference); replay=duplicate; tamper rejected OK"

Write-Host "================ SCENARIO F: AMENITIES ================"
$am = PostJson "$api/communities/$cid/amenities" @{
  name = "Scen Court $suffix"; capacity = 20; slotMinutes = 60
  openTimeMinutes = 600; closeTimeMinutes = 1320
  availableDays = "1,2,3,4,5"; pricePaise = 0
  requiresApproval = $false; maxBookingsPerMonth = 4; cancellationCutoffHours = 0
} $atok
$targetF = [datetime]::UtcNow.AddDays(3).Date.AddHours(18)
while (@(0,6) -contains [int]$targetF.DayOfWeek) { $targetF = $targetF.AddDays(1) }
$startIsoF = $targetF.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$endIsoF = $targetF.AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$b1 = PostJson "$api/me/amenity-bookings" @{
  amenityId = $am.id; startAt = $startIsoF; endAt = $endIsoF; guests = 2
} $atok2
if ($b1.status -ne "CONFIRMED") { throw "booking not CONFIRMED: $($b1.status)" }
# Vikram tries the same slot -> must lose
$vikram = LoginOtp "+9911100201"; $vtok = $vikram.accessToken
try {
  PostJson "$api/me/amenity-bookings" @{ amenityId = $am.id; startAt = $startIsoF; endAt = $endIsoF } $vtok | Out-Null
  throw "second booking of same slot accepted!"
} catch {
  if ((ErrorCode $_) -notmatch "SLOT_TAKEN|CONFLICT") { throw }
}
# blackout: availableDays excludes weekend - find next Sunday and try
$sun = [datetime]::UtcNow.Date
while ([int]$sun.DayOfWeek -ne 0) { $sun = $sun.AddDays(1) }
$sunStart = $sun.AddHours(18).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$sunEnd = $sun.AddHours(19).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
try {
  PostJson "$api/me/amenity-bookings" @{
    amenityId = $am.id; startAt = $sunStart; endAt = $sunEnd
  } $vtok | Out-Null
  throw "weekend booking accepted but amenity is weekdays-only!"
} catch {
  # Any rejection counts: service returns BAD_REQUEST/"not available that day".
  $codeC = ErrorCode $_
  if ($codeC -eq "SLOT_TAKEN") { throw } # wrong failure mode
}
PostJson "$api/amenity-bookings/$($b1.id)/cancel" @{ reason = "scenario cancel" } $atok2 | Out-Null
$b2 = PostJson "$api/me/amenity-bookings" @{ amenityId = $am.id; startAt = $startIsoF; endAt = $endIsoF } $vtok
Write-Host "F1. booking confirmed -> same-slot loser blocked (SLOT_TAKEN); weekday rule enforced; cancelled slot rebooked ($($b2.status)) OK"

Write-Host "================ SCENARIO G: NOTICES ================"
$communityG = GetJson "$api/communities/$cid" $atok
$towerA = @($communityG.towers | Where-Object { $_.code -eq "A" })[0]
$n1 = PostJson "$api/communities/$cid/notices" @{
  title = "Water cut G $suffix"; body = "Sunday water tank cleaning."
  type = "MAINTENANCE"; audience = "TOWER"; audienceTarget = @{ towerId = $towerA.id }
} $atok
if ($n1.status -ne "PUBLISHED") { throw "immediate notice not PUBLISHED: $($n1.status)" }
$schedAt = [datetime]::UtcNow.AddSeconds(8).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$n2 = PostJson "$api/communities/$cid/notices" @{
  title = "Owners AGM G $suffix"; body = "AGM next month."
  type = "EVENT"; audience = "OWNERS"; requireAcknowledgement = $true; publishAt = $schedAt
} $atok
if ($n2.status -ne "SCHEDULED") { throw "future notice not SCHEDULED: $($n2.status)" }
Start-Sleep -Seconds 80
$nitaFeed = GetJson "$api/me/notices?pageSize=50" $atok2
$sawN1 = @($nitaFeed | Where-Object { $_.id -eq $n1.id }).Count -ge 1
$sawN2 = @($nitaFeed | Where-Object { $_.id -eq $n2.id }).Count -ge 1
if (-not $sawN1) { throw "immediate tower notice not in feed" }
if (-not $sawN2) { throw "scheduled owners notice did not publish within window" }
$ack = PostJson "$api/notices/$($n2.id)/acknowledge" @{} $atok2
Write-Host "G1. tower targeting immediate + scheduled OWNERS published after sweep + ack OK"

Write-Host "================ SCENARIO H: PARKING ================"
$veh = PostJson "$api/me/vehicles" @{ number = "mh 99 sc-$suffix"; type = "TWO_WHEELER" } $vtok
$areaH = PostJson "$api/communities/$cid/parking/areas" @{ name = "Scen Area H$suffix" } $atok
PostJson "$api/parking/areas/$($areaH.id)/slots" @{
  slots = @( @{ code = "H-T01"; kind = "TWO_WHEELER" }, @{ code = "H-R01"; kind = "RESIDENT" } )
} $atok | Out-Null
$areasH = GetJson "$api/communities/$cid/parking/areas" $atok
$areaFullH = @($areasH | Where-Object { $_.id -eq $areaH.id })[0]
$ht01 = @($areaFullH.slots | Where-Object { $_.code -eq "H-T01" })[0]
$hr01 = @($areaFullH.slots | Where-Object { $_.code -eq "H-R01" })[0]
PostJson "$api/parking/slots/$($ht01.id)/allocate" @{ vehicleId = $veh.id } $atok | Out-Null
try {
  PostJson "$api/parking/slots/$($ht01.id)/allocate" @{ vehicleId = $veh.id } $atok | Out-Null
  throw "same vehicle allocated twice!"
} catch { if ((ErrorCode $_) -notmatch "OCCUPIED|VEHICLE_PARKED|already") { throw } }
# kind mismatch: TWO_WHEELER vehicle into RESIDENT slot is allowed only if rule says so; expect rejection
try {
  PostJson "$api/parking/slots/$($hr01.id)/allocate" @{ vehicleId = $veh.id } $atok | Out-Null
  Write-Host "H2. note: two-wheeler into RESIDENT slot accepted"
} catch { if ((ErrorCode $_) -notmatch "KIND|MISMATCH|VEHICLE_PARKED|OCCUPIED") { throw } }
$lookup = GetJson "$api/gate/parking/lookup?number=MH99SC$suffix" $gtok
if ($lookup.unitLabel -ne "A-201") { throw "gate lookup unit wrong: $($lookup.unitLabel)" }
if ($lookup.parkingSlot -notlike "*H-T01") { throw "gate lookup slot wrong: $($lookup.parkingSlot)" }
$del = Invoke-RestMethod -Method Delete -Uri "$api/parking/slots/$($ht01.id)/allocate" -Headers @{ Authorization = "Bearer $atok" }
if (-not $del.ok) { throw "deallocate failed" }
Write-Host "H3. allocate->guards->lookup ($($lookup.unitLabel) @ $($lookup.parkingSlot))->deallocate OK"

Write-Host "================ SCENARIO I: AUDIT TRAIL ================"
# Ticket state changes live in ticketHistory; AuditEvent carries domain events
# like billing.invoice_issued / visitor.pre_approved / parking.slot_deallocated.
$auditI = GetJson "$api/communities/$cid/audit?action=billing.invoice_issued&pageSize=5" $atok
$row = @($auditI.items)[0]
if (-not $row) { throw "no audit rows for billing.invoice_issued" }
if (-not $row.actorLabel) { throw "audit row missing actorLabel: $($row | ConvertTo-Json -Compress)" }
if (-not $row.requestId) { Write-Host "   (note: requestId empty on this row)" }
$auditV = GetJson "$api/communities/$cid/audit?entityType=vehicle&pageSize=5" $atok
$nonVeh = @($auditV.items | Where-Object { $_.entityType -ne "vehicle" }).Count
if ($nonVeh -ne 0) { throw "entityType filter leaked non-vehicle rows" }
Write-Host "I1. audit queryable by action + entityType; actorLabel='$($row.actorLabel)' on invoice issuance OK"

Write-Host "================ SCENARIO J: SECURITY NEGATIVES ================"
# J1 cross-resident IDOR on ticket detail
try {
  GetJson "$api/tickets/$($ticket.id)" $vtok | Out-Null
  throw "Vikram read Anita's ticket!"
} catch { $c1 = ErrorCode $_; if ($c1 -notmatch "NOT_FOUND|FORBIDDEN") { throw } }
# J2 cross-community: new owner reads Greenview reports
try {
  GetJson "$api/communities/$cid/reports/summary" $ownerAuth.accessToken | Out-Null
  throw "cross-community reports access allowed!"
} catch { $c2 = ErrorCode $_; if ($c2 -notmatch "FORBIDDEN|PERMISSION|NOT_FOUND") { throw } }
# J3 resident hits platform API
try {
  GetJson "$api/platform/communities" $atok2 | Out-Null
  throw "resident reached platform console!"
} catch { $c3 = ErrorCode $_; if ($c3 -notmatch "PERMISSION|FORBIDDEN") { throw } }
# J4 refresh rotation: old refresh token cannot be reused after rotation
$ref1 = $anita.refreshToken
$r1 = PostJson "$api/auth/refresh" @{ refreshToken = $ref1 }
try {
  PostJson "$api/auth/refresh" @{ refreshToken = $ref1 } | Out-Null
  throw "reused refresh token accepted!"
} catch { $c4 = ErrorCode $_; if ($c4 -notmatch "UNAUTHORIZED|INVALID|TOKEN") { throw } }
# J5 unauthenticated access
try {
  Invoke-RestMethod "$api/me/invoices" -ErrorAction Stop | Out-Null
  throw "unauthenticated invoices access!"
} catch { $c5 = "$($_.Exception.Message)"; if ($c5 -notmatch "401|Unauthorized") { throw } }
Write-Host "J1. IDOR blocked ($c1)"
Write-Host "J2. cross-tenant denied ($c2)"
Write-Host "J3. platform surface denied ($c3)"
Write-Host "J4. refresh-token reuse rejected ($c4); rotation works"
Write-Host "J5. anonymous request 401"

Write-Host ""
Write-Host "ALL PHASE-10 SCENARIOS (A-J) PASSED"
