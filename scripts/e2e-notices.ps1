# SocietyOS E2E - Notices (Phase 7): audience targeting + scheduled publish + ack
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
# NOTE: PS 5.1 simplified Where-Object (prop -eq value) proved unreliable in
# nested script scope here -- always use scriptblock form.
function CountId($list, $id) {
  return @($list | Where-Object { $_.id -eq $id }).Count
}

$admin = PostJson "$api/auth/login" @{ identifier = "admin@greenview.test"; password = "Demo#Pass1" }
$atok = $admin.accessToken
$cid = $admin.context.communityId

function LoginOtp($target) {
  $null = PostJson "$api/auth/request-otp" @{ target = $target }
  Start-Sleep -Milliseconds 800
  $enc = [uri]::EscapeDataString($target)
  $c = (Invoke-RestMethod "$api/__dev/last-otp?target=$enc").code
  return PostJson "$api/auth/verify-otp" @{ target = $target; code = $c }
}
$anita = LoginOtp "anita@example.com"        # owner A-101, tower A
$vikram = LoginOtp "+9911100201"             # tenant B-201, tower B

Write-Host "1. users logged in"

$community = GetJson "$api/communities/$cid" $atok
$towerA = @($community.towers | Where-Object { $_.code -eq "A" })[0]
if (-not $towerA) { throw "Tower A missing" }
Write-Host "2. tower A found"

$n1 = PostJson "$api/communities/$cid/notices" @{
  title = "Water tank cleaning Tower A"
  body = "Water supply interrupted 10:00-13:00 tomorrow in Tower A."
  type = "MAINTENANCE"
  audience = "TOWER"
  audienceTarget = @{ towerId = $towerA.id }
} $atok
if ($n1.status -ne "PUBLISHED") { throw "immediate notice not PUBLISHED: $($n1.status)" }
Write-Host "3. tower-A notice published immediately"

$schedAt = [datetime]::UtcNow.AddSeconds(8).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$n2 = PostJson "$api/communities/$cid/notices" @{
  title = "AGM next month"
  body = "Annual general meeting for all owners."
  type = "EVENT"
  audience = "OWNERS"
  requireAcknowledgement = $true
  publishAt = $schedAt
} $atok
if ($n2.status -ne "SCHEDULED") { throw "future notice not SCHEDULED: $($n2.status)" }
Write-Host "4. owners-only ACK notice scheduled (+8s)"

Start-Sleep 14
$mineA = GetJson "$api/me/notices" $anita.accessToken
$mineV = GetJson "$api/me/notices" $vikram.accessToken

if ((CountId $mineA $n1.id) -ne 1) { throw "Anita (tower A) should see tower-A notice" }
if ((CountId $mineV $n1.id) -ne 1) { throw "Vikram is ALSO in tower A (A-201), must see it too" }
Write-Host "5. TOWER targeting OK (both tower-A residents see it)"

# Floor-scoped notice: level 1 only -> Anita (A-101) yes, Vikram (A-201 = level 2) no.
$n3 = PostJson "$api/communities/$cid/notices" @{
  title = "Floor 1 corridor lights"
  body = "Electrician on floor 1 corridor today."
  type = "MAINTENANCE"
  audience = "FLOOR"
  audienceTarget = @{ towerId = $towerA.id; floor = 1 }
} $atok
Start-Sleep 2
$mineA2 = GetJson "$api/me/notices" $anita.accessToken
$mineV2 = GetJson "$api/me/notices" $vikram.accessToken
if ((CountId $mineA2 $n3.id) -ne 1) { throw "Anita (A-101, level 1) should see FLOOR notice" }
if ((CountId $mineV2 $n3.id) -ne 0) { throw "Vikram (A-201, level 2) must NOT see FLOOR notice" }
Write-Host "5b. FLOOR targeting OK (level 1 sees, level 2 blocked)"

# Poll up to 80s for the scheduled publish sweep to land (tick every 30s).
$gotN2A = 0
for ($i = 0; $i -lt 8; $i++) {
  Start-Sleep 10
  $mineA = GetJson "$api/me/notices" $anita.accessToken
  $gotN2A = CountId $mineA $n2.id
  if ($gotN2A -ge 1) { break }
}
if ($gotN2A -lt 1) { throw "scheduled notice never appeared for Anita" }
Write-Host "6. scheduled publish sweep fired -> notice live for owners"

if ((CountId $mineV $n2.id) -ne 0) { throw "Vikram is a tenant, must not receive OWNERS notice" }
Write-Host "7. OWNERS targeting OK (tenant excluded)"

PostJson "$api/notices/$($n2.id)/acknowledge" @{} $anita.accessToken | Out-Null
$mineA3 = GetJson "$api/me/notices" $anita.accessToken
$ackd = @($mineA3 | Where-Object { $_.id -eq $n2.id })[0]
if (-not $ackd.acknowledged) { throw "ack not recorded" }
Write-Host "8. acknowledgement recorded"

$allN = GetJson "$api/communities/$cid/notices" $atok
if (@($allN | Where-Object { $_.id -in @($n1.id, $n2.id) }).Count -ne 2) { throw "admin list incomplete" }
Write-Host "9. admin notice board lists all notices"

Write-Host ""
Write-Host "ALL NOTICES E2E CHECKS PASSED" -ForegroundColor Green
