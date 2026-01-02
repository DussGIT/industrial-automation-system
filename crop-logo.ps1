Add-Type -AssemblyName System.Drawing

$inputPath = "c:\Industrial Automation\frontend\public\assets\duss-logo.png"
$img = [System.Drawing.Image]::FromFile($inputPath)
$bmp = New-Object System.Drawing.Bitmap $img
$img.Dispose()

# Find actual content bounds
$minY = $bmp.Height
$maxY = 0
$minX = $bmp.Width
$maxX = 0

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $pixel = $bmp.GetPixel($x, $y)
        if ($pixel.A -gt 10) {
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
        }
    }
}

Write-Host "Content bounds: X=$minX-$maxX, Y=$minY-$maxY"

$cropWidth = $maxX - $minX + 1
$cropHeight = $maxY - $minY + 1

Write-Host "Cropping to: $cropWidth x $cropHeight"

$croppedBmp = New-Object System.Drawing.Bitmap($cropWidth, $cropHeight)
$graphics = [System.Drawing.Graphics]::FromImage($croppedBmp)
$srcRect = New-Object System.Drawing.Rectangle($minX, $minY, $cropWidth, $cropHeight)
$graphics.DrawImage($bmp, 0, 0, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$tempPath = [System.IO.Path]::GetTempFileName() + ".png"
$croppedBmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$croppedBmp.Dispose()
$bmp.Dispose()

Move-Item $tempPath $inputPath -Force
Write-Host "Logo cropped successfully"
