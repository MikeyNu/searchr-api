$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRef = "fdtncidguldauilzlxgs"
$ProjectUrl = "https://$ProjectRef.supabase.co"
$FunctionName = "scriptory-api"
$FunctionUrl = "$ProjectUrl/functions/v1/$FunctionName"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir

function Convert-SecureStringToPlainText {
  param([securestring]$Value)
  if ($null -eq $Value) { return "" }
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Read-EnvFile {
  param([string]$Path)
  $result = @{}
  if (!(Test-Path $Path)) { return $result }
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim().Trim([char]0xFEFF)
    if (!$trimmed -or $trimmed.StartsWith("#")) { continue }
    $index = $trimmed.IndexOf("=")
    if ($index -le 0) { continue }
    $key = $trimmed.Substring(0, $index).Trim()
    $value = $trimmed.Substring($index + 1).Trim().Trim('"').Trim("'")
    $result[$key] = $value
  }
  return $result
}

function Write-Utf8NoBomLines {
  param([string]$Path, [string[]]$Lines)
  $encoding = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($Path, $Lines, $encoding)
}

function New-SecretToken {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Write-Step {
  param([string]$Message)
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

Set-Location $Root

if (!(Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI is not installed or not available on PATH."
}

$supabaseEnvPath = Join-Path $Root "supabase\.env"
$localEnv = Read-EnvFile (Join-Path $Root ".env")
$existingSupabaseEnv = Read-EnvFile $supabaseEnvPath

Write-Step "Collecting secrets without echoing them"
$accessToken = Convert-SecureStringToPlainText (Read-Host "Supabase access token" -AsSecureString)
if (!$accessToken) { throw "Supabase access token is required." }

$dbPassword = Convert-SecureStringToPlainText (Read-Host "Supabase database password" -AsSecureString)
if (!$dbPassword) { throw "Supabase database password is required for db push." }

$serviceRoleKey = $existingSupabaseEnv["SUPABASE_SERVICE_ROLE_KEY"]
if (!$serviceRoleKey) {
  $serviceRoleKey = Convert-SecureStringToPlainText (Read-Host "Supabase service_role key" -AsSecureString)
}
if (!$serviceRoleKey) { throw "Supabase service_role key is required for local Edge Function serving." }

$adminToken = $existingSupabaseEnv["ADMIN_TOKEN"]
if (!$adminToken) { $adminToken = $localEnv["ADMIN_TOKEN"] }
if (!$adminToken) { $adminToken = New-SecretToken }

$allowedOrigins = $localEnv["ALLOWED_ORIGINS"]
if (!$allowedOrigins) { $allowedOrigins = "http://127.0.0.1:8082,http://localhost:8082" }

$envLines = @(
  "SUPABASE_URL=$ProjectUrl",
  "SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey",
  "ALLOWED_ORIGINS=$allowedOrigins",
  "",
  "ADZUNA_APP_ID=$($localEnv['ADZUNA_APP_ID'])",
  "ADZUNA_APP_KEY=$($localEnv['ADZUNA_APP_KEY'])",
  "ADZUNA_QUERIES=$($localEnv['ADZUNA_QUERIES'])",
  "ADZUNA_LOCATIONS=$($localEnv['ADZUNA_LOCATIONS'])",
  "ADZUNA_RESULTS_PER_QUERY=$($localEnv['ADZUNA_RESULTS_PER_QUERY'])",
  "",
  "GREENHOUSE_BOARDS=$($localEnv['GREENHOUSE_BOARDS'])",
  "LEVER_COMPANIES=$($localEnv['LEVER_COMPANIES'])",
  "PARTNER_FEED_URLS=$($localEnv['PARTNER_FEED_URLS'])",
  "",
  "ADMIN_TOKEN=$adminToken"
)

Write-Step "Writing ignored Supabase env file"
Write-Utf8NoBomLines -Path $supabaseEnvPath -Lines $envLines

$edgeSecretsPath = Join-Path ([System.IO.Path]::GetTempPath()) "searchr-supabase-secrets.env"
$edgeSecretLines = $envLines | Where-Object { $_ -and !($_.StartsWith("SUPABASE_")) }
Write-Utf8NoBomLines -Path $edgeSecretsPath -Lines $edgeSecretLines

$env:SUPABASE_ACCESS_TOKEN = $accessToken
$env:SUPABASE_DB_PASSWORD = $dbPassword

Write-Step "Linking Supabase project"
supabase link --project-ref $ProjectRef --yes

Write-Step "Pushing database migration"
supabase db push

Write-Step "Uploading Edge Function secrets"
supabase secrets set --env-file $edgeSecretsPath --project-ref $ProjectRef
Remove-Item $edgeSecretsPath -Force -ErrorAction SilentlyContinue

Write-Step "Deploying Edge Function"
supabase functions deploy $FunctionName --project-ref $ProjectRef --no-verify-jwt --use-api

Write-Step "Checking hosted health endpoint"
$health = Invoke-RestMethod -Method Get -Uri "$FunctionUrl/health" -TimeoutSec 30
if (!$health.ok) { throw "Hosted health endpoint did not return ok=true." }

Write-Step "Running initial job ingestion"
$headers = @{ Authorization = "Bearer $adminToken" }
$ingestion = Invoke-RestMethod -Method Post -Uri "$FunctionUrl/v1/ingest/run" -Headers $headers -TimeoutSec 180

Write-Host "`nSupabase setup complete." -ForegroundColor Green
Write-Host "Function URL: $FunctionUrl"
Write-Host "Health: ok"
Write-Host "Jobs after ingestion: $($ingestion.totalJobs)"
Write-Host "Admin token was stored in supabase\.env and uploaded as an Edge Function secret."