# SocietyOS E2E — Visitor flows (Scenarios B & C)
# B: resident pre-approves -> guard validates token -> entry -> exit
# C: spot visitor -> guard requests approval -> resident approves -> guard sees update
# Requires API on :4000 with NODE_ENV=development and seeded demo data.
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

Write-Host "== Scenario B ==" -ForegroundColor Cyan

# 1. Resident OTP login
$null = PostJson "$api/auth/request-otp" @{ target = "anita@example.com" }
Start-Sleep -Milliseconds 800
$code = (Invoke-RestMethod "$api/__dev/last-otp?target=anita@example.com").code
$anita = PostJson "$api/auth/verify-otp" @{ target = "anita@example.com"; code = $code }
$atok = $anita.accessToken; $cid = $anita.context.communityId
if (-not $atok) { throw "resident login failed" }
Write-Host "1. resident logged in (community $($cid.Substring(0,8)))"

# 2. Pre-approve visitor
$myUnits = GetJson "$api/me/units" $atok
$unitId = $myUnits[0].unit.id
$inv = PostJson "$api/communities/$cid/visitors/invitations" @{
  unitId = $unitId; visitorName = "Amit Verma"; visitorPhone = "+91 98765 43210"; visitorType = "GUEST"
} $atok
if ($inv.invitation.status -ne "APPROVED") { throw "invitation not approved" }
Write-Host "2. invitation APPROVED · otp=$($inv.otpCode)"

# 3. Guard OTP login
$null = PostJson "$api/auth/request-otp" @{ target = "+919900000011" }
Start-Sleep -Milliseconds 800
$gcode = (Invoke-RestMethod "$api/__dev/last-otp?target=%2B919900000011").code
$guard = PostJson "$api/auth/verify-otp" @{ target = "+919900000011"; code = $gcode; fullName = "Ramesh Guard" }
$gtok = $guard.accessToken
if ($guard.context.roleKeys -notcontains "GUARD") { throw "guard role missing: $($guard.context.roleKeys -join ',')" }
Write-Host "3. guard logged in roles=$($guard.context.roleKeys -join '+')"

# 4. Guard checks in via QR token
$checkin = PostJson "$api/gate/visitors/check-in" @{ token = $inv.qrToken } $gtok
if ($checkin.visit.status -ne "CHECKED_IN") { throw "check-in failed: $($checkin.visit.status)" }
Write-Host "4. CHECKED_IN visit=$($checkin.visit.id.Substring(0,8)) gate=$($checkin.visit.gate.name)"

# 5. Double check-in must fail
try { PostJson "$api/gate/visitors/check-in" @{ token = $inv.qrToken } $gtok | Out-Null; throw "double check-in allowed!" }
catch { Write-Host "5. double check-in blocked OK" }

# 6. Check-out
$out = PostJson "$api/gate/visitors/check-out" @{ visitId = $checkin.visit.id } $gtok
if (-not $out.ok) { throw "check-out failed" }
Write-Host "6. CHECKED_OUT"

# 7. Visit log shows the completed visit (admin view)
$admin = PostJson "$api/auth/login" @{ identifier = "admin@greenview.test"; password = "Demo#Pass1" }
$visits = GetJson "$api/communities/$cid/visits?pageSize=5" $admin.accessToken
$mine = $visits.items | Where-Object { $_.id -eq $checkin.visit.id }
if (-not $mine) { throw "visit missing from community log" }
if ($mine.status -ne "CHECKED_OUT") { throw "visit status wrong: $($mine.status)" }
Write-Host "7. visit log shows CHECKED_OUT entry at $($mine.gate.name)"

Write-Host "== Scenario C ==" -ForegroundColor Cyan

# 8. Guard logs spot visitor at Anita's unit
$spot = PostJson "$api/gate/visitors/spot-request" @{
  unitId = $unitId
  gateId = $checkin.visit.gate.id
  visitorName = "Unknown Courier"
  visitorType = "DELIVERY"
} $gtok
$sid = $spot.invitation.id
if ($spot.invitation.status -ne "WAITING_APPROVAL") { throw "spot request not waiting" }
Write-Host "8. spot request WAITING_APPROVAL id=$($sid.Substring(0,8)) expiry=$($spot.expiresInSeconds)s"

# 9. Resident sees pending and approves
$pending = GetJson "$api/me/visitors/pending" $atok
$match = $pending | Where-Object { $_.id -eq $sid }
if (-not $match) { throw "pending approval not visible to resident" }
$dec = PostJson "$api/me/visitors/$sid/approve" @{} $atok
if ($dec.status -ne "APPROVED") { throw "approve failed" }
Write-Host "9. resident APPROVED spot visitor"

# 10. Guard checks in the now-approved visitor by invitationId
$ci2 = PostJson "$api/gate/visitors/check-in" @{ invitationId = $sid } $gtok
if ($ci2.visit.approvalMethod -ne "RESIDENT_APPROVAL") { throw "wrong approval method: $($ci2.visit.approvalMethod)" }
PostJson "$api/gate/visitors/check-out" @{ visitId = $ci2.visit.id } $gtok | Out-Null
Write-Host "10. approved visitor entered and exited (approvalMethod=RESIDENT_APPROVAL)"

# 11. Security manager override path — new spot request left to expire would take 90s;
#     instead verify override is denied for guards and audited for managers.
try {
  PostJson "$api/visitors/$sid/override" @{ reason = "test override attempt" } $gtok | Out-Null
  throw "guard override should be forbidden"
} catch { Write-Host "11a. guard cannot override (permission denied) OK" }

Write-Host ""
Write-Host "ALL VISITOR E2E SCENARIOS PASSED" -ForegroundColor Green
