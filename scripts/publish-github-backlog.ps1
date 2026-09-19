param(
  [string]$Repository = "1ZH13/TaskManager"
)

$ErrorActionPreference = "Stop"
$manifestPath = Join-Path $PSScriptRoot "..\.github\backlog.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json

gh auth status --hostname github.com | Out-Null
$existingIssues = @(gh issue list `
  --repo $Repository `
  --state all `
  --limit 1000 `
  --json number,title,url | ConvertFrom-Json)

foreach ($label in $manifest.labels) {
  gh label create $label.name `
    --repo $Repository `
    --color $label.color `
    --description $label.description `
    --force | Out-Null
}

$epicUrls = @{}
foreach ($epic in $manifest.epics) {
  $existing = $existingIssues | Where-Object { $_.title -eq $epic.title } | Select-Object -First 1

  if ($existing) {
    gh issue edit $existing.number `
      --repo $Repository `
      --body $epic.body `
      --add-label ($epic.labels -join ',') | Out-Null
    $epicUrls[$epic.key] = $existing.url
    continue
  }

  $epicUrls[$epic.key] = gh issue create `
    --repo $Repository `
    --title $epic.title `
    --body $epic.body `
    --label ($epic.labels -join ',')
}

foreach ($issue in $manifest.issues) {
  $epicUrl = $epicUrls[$issue.epic]
  $body = "Épico: $epicUrl`n`n$($issue.body)"
  $existing = $existingIssues | Where-Object { $_.title -eq $issue.title } | Select-Object -First 1

  if ($existing) {
    gh issue edit $existing.number `
      --repo $Repository `
      --body $body `
      --add-label ($issue.labels -join ',') | Out-Null
    continue
  }

  gh issue create `
    --repo $Repository `
    --title $issue.title `
    --body $body `
    --label ($issue.labels -join ',') | Out-Null
}

Write-Host "Backlog publicado en https://github.com/$Repository/issues"
