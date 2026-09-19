param(
  [string]$Repository = "1ZH13/TaskManager"
)

$ErrorActionPreference = "Stop"
$manifestPath = Join-Path $PSScriptRoot "..\.github\backlog.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json

gh auth status --hostname github.com | Out-Null

foreach ($label in $manifest.labels) {
  gh label create $label.name `
    --repo $Repository `
    --color $label.color `
    --description $label.description `
    --force | Out-Null
}

$epicUrls = @{}
foreach ($epic in $manifest.epics) {
  $existingUrl = gh issue list `
    --repo $Repository `
    --state all `
    --search ('"' + $epic.title + '" in:title') `
    --json title,url `
    --jq ('.[] | select(.title == "' + ($epic.title -replace '"', '\"') + '") | .url')

  if ($existingUrl) {
    $epicUrls[$epic.key] = ($existingUrl | Select-Object -First 1)
    continue
  }

  $epicUrls[$epic.key] = gh issue create `
    --repo $Repository `
    --title $epic.title `
    --body $epic.body `
    --label ($epic.labels -join ',')
}

foreach ($issue in $manifest.issues) {
  $existingUrl = gh issue list `
    --repo $Repository `
    --state all `
    --search ('"' + $issue.title + '" in:title') `
    --json title,url `
    --jq ('.[] | select(.title == "' + ($issue.title -replace '"', '\"') + '") | .url')

  if ($existingUrl) {
    continue
  }

  $epicUrl = $epicUrls[$issue.epic]
  $body = "Épico: $epicUrl`n`n$($issue.body)"
  gh issue create `
    --repo $Repository `
    --title $issue.title `
    --body $body `
    --label ($issue.labels -join ',') | Out-Null
}

Write-Host "Backlog publicado en https://github.com/$Repository/issues"
