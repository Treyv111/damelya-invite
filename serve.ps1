$root = Join-Path $PSScriptRoot "docs"
$prefix = "http://127.0.0.1:8080/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "Открой $prefix"
Write-Output "Остановка: Ctrl+C"

$types = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".woff2" = "font/woff2"
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.LocalPath)
    if ($rel -eq "/") { $rel = "/index.html" }
    $full = [IO.Path]::GetFullPath((Join-Path $root ($rel.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar))))
    $rootFull = [IO.Path]::GetFullPath($root)
    if (-not $full.StartsWith($rootFull)) {
      $ctx.Response.StatusCode = 403
      $ctx.Response.Close()
      continue
    }
    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
      $bytes = [IO.File]::ReadAllBytes($full)
      $ctx.Response.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" })
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
