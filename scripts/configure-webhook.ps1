param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string]$WorkerUrl
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
  $secureToken = Read-Host 'BotFather tokenini girin (ekranda görünmez)' -AsSecureString
  $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  $webhookSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })

  $token | npx wrangler secret put TELEGRAM_BOT_TOKEN
  if ($LASTEXITCODE -ne 0) { throw 'TELEGRAM_BOT_TOKEN kaydedilemedi.' }
  $webhookSecret | npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
  if ($LASTEXITCODE -ne 0) { throw 'TELEGRAM_WEBHOOK_SECRET kaydedilemedi.' }

  $body = @{
    url = "$($WorkerUrl.TrimEnd('/'))/webhook"
    secret_token = $webhookSecret
    allowed_updates = @('message', 'callback_query')
    drop_pending_updates = $false
  } | ConvertTo-Json

  $result = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -ContentType 'application/json' -Body $body
  if (-not $result.ok) { throw 'Telegram webhook kaydı başarısız.' }
  Write-Host 'Webhook güvenli biçimde kaydedildi.' -ForegroundColor Green
}
finally {
  if ($tokenPointer) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
  $token = $null
  $secureToken = $null
  $webhookSecret = $null
  Pop-Location
}

