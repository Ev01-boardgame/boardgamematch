# Reset Ev01 to match main (overwrite Ev01 with latest main)
# Run: .\reset-ev01-to-main.ps1

Set-Location $PSScriptRoot

Write-Host "Fetching main and overwriting Ev01..." -ForegroundColor Cyan
git fetch origin main
git checkout Ev01
git reset --hard origin/main
git push origin Ev01 --force
Write-Host "Done! Ev01 is now synced with main." -ForegroundColor Green
