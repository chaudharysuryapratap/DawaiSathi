$ErrorActionPreference = "Stop"
$frontend = $PSScriptRoot
if ((Split-Path $frontend -Leaf) -ne "frontend") { throw "Save this script in the frontend folder." }

$paths = @{
 Header = Join-Path $frontend "src\components\app-header.tsx"
 Family = Join-Path $frontend "src\components\family-group-selector.tsx"
 Sheet = Join-Path $frontend "src\components\bottom-sheet.tsx"
}
$orig=@{}; $bytes=@{}; $patched=@{}; $nl=@{}
foreach($k in $paths.Keys){
 if(!(Test-Path -LiteralPath $paths[$k] -PathType Leaf)){throw "Missing file $($paths[$k]); no changes made."}
 $bytes[$k]=[IO.File]::ReadAllBytes($paths[$k]); if(!$bytes[$k].Length){throw "Empty file $k; no changes made."}
 $orig[$k]=[IO.File]::ReadAllText($paths[$k]); $nl[$k]=if($orig[$k].Contains("`r`n")){"`r`n"}else{"`n"}
 $patched[$k]=$orig[$k] -replace "`r`n","`n"
}
function Once([string]$s,[string]$old,[string]$new,[string]$label){
 $i=$s.IndexOf($old,[StringComparison]::Ordinal)
 if($i -lt 0){throw "$label not found; no source files written."}
 if($s.IndexOf($old,$i+$old.Length,[StringComparison]::Ordinal) -ge 0){throw "$label occurs more than once; no source files written."}
 return $s.Substring(0,$i)+$new+$s.Substring($i+$old.Length)
}
function RegexOnce([string]$s,[string]$pattern,[string]$replacement,[string]$label){
 $m=[regex]::Matches($s,$pattern)
 if($m.Count -ne 1){throw "$label expected one match; found $($m.Count). No source files written."}
 return [regex]::Replace($s,$pattern,$replacement,[Text.RegularExpressions.RegexOptions]::Singleline)
}

# AppHeader: add member selector import and row.
$patched.Header=Once $patched.Header 'import { FamilyGroupSelector } from "@/src/components/family-group-selector";' 'import { FamilyGroupSelector } from "@/src/components/family-group-selector";
import { MemberSelector } from "@/src/components/member-selector";' "MemberSelector import"
$patched.Header=Once $patched.Header '      <AttentionCenter visible={showAttention} onClose={() => setShowAttention(false)} />' '      <View style={styles.memberRow}>
        <MemberSelector />
      </View>
      <AttentionCenter visible={showAttention} onClose={() => setShowAttention(false)} />' "MemberSelector row"
$patched.Header=RegexOnce $patched.Header '(?ms)^    brandRow:\s*\{.*?^    \},' '    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    memberRow: { alignItems: "flex-start" },' "AppHeader brandRow styles"

# Family label.
$patched.Family=Once $patched.Family 'selectorLabel: { color: colors.onSurface, fontSize: 20, fontWeight: "850", letterSpacing: -0.3, maxWidth: 280 },' 'selectorLabel: { color: colors.onSurface, fontSize: 22, fontWeight: "800", letterSpacing: -0.3, maxWidth: 280 },' "Family label typography"

# BottomSheet modal structure.
$modalPattern='(?s)  return \(\s*<Modal\s+visible=\{visible\}\s+transparent\s+animationType=\{Platform\.OS === "web" \? "fade" : "none"\}\s+onRequestClose=\{onClose\}\s*>\s*<Pressable style=\{styles\.backdrop\} onPress=\{onClose\} testID=\{testID \? `\$\{testID\}-backdrop` : undefined\} />\s*<Animated\.View style=\{\[styles\.sheet, animated\]\} testID=\{testID\}>\s*<View style=\{\[styles\.sheetInner, \{ paddingTop: 10 \}\]\}>\{containerBody\}</View>\s*</Animated\.View>\s*</Modal>\s*\);\s*'
$newModal=@'
  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === "web" ? "fade" : "none"}
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        <Animated.View style={[styles.sheet, animated]} testID={testID}>
          <View style={[styles.sheetInner, { paddingTop: 10 }]}>{containerBody}</View>
        </Animated.View>
      </View>
    </Modal>
  );
'@
$patched.Sheet=RegexOnce $patched.Sheet $modalPattern $newModal "BottomSheet modal JSX"
$stylePattern='(?s)  backdrop:\s*\{\s*\.\.\.StyleSheet\.absoluteFillObject,\s*backgroundColor:\s*"rgba\(15,23,20,0\.45\)",\s*\},\s*sheet:\s*\{\s*position:\s*"absolute",\s*left:\s*0,\s*right:\s*0,\s*bottom:\s*0,\s*maxHeight:\s*"92%",\s*\},'
$newStyle=@'
  modalRoot: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,20,0.45)",
    zIndex: 0,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "92%",
    zIndex: 1,
    elevation: 1,
  },
'@
$patched.Sheet=RegexOnce $patched.Sheet $stylePattern $newStyle "BottomSheet styles"

$checks=@(
 @{K="Header";V='import { MemberSelector } from "@/src/components/member-selector";'},
 @{K="Header";V="<MemberSelector />"},
 @{K="Header";V='memberRow: { alignItems: "flex-start" }'},
 @{K="Family";V='fontSize: 22, fontWeight: "800"'},
 @{K="Sheet";V='modalRoot: { flex: 1 }'},
 @{K="Sheet";V='onPress={onClose}'},
 @{K="Sheet";V='onRequestClose={onClose}'},
 @{K="Sheet";V="zIndex: 1"}
)
foreach($c in $checks){if(!$patched[$c.K].Contains($c.V)){throw "Pre-write check failed ($($c.K)); no source files written."}}

$backup=Join-Path $frontend ("dawaisathi-patch-backup-"+(Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $backup | Out-Null
foreach($k in $paths.Keys){
 $b=Join-Path $backup "$k.original.tsx"; [IO.File]::WriteAllBytes($b,$bytes[$k])
 if(([IO.File]::ReadAllBytes($b)).Length -ne $bytes[$k].Length){throw "Backup failed for $k; no source files written."}
}
Write-Host "Verified backup: $backup" -ForegroundColor Cyan

try {
 foreach($k in @("Header","Family","Sheet")){
  $text=$patched[$k]; if($nl[$k] -eq "`r`n"){$text=$text.Replace("`n","`r`n")}
  [IO.File]::WriteAllText($paths[$k],$text,[Text.UTF8Encoding]::new($false))
 }
 foreach($c in $checks){if(!([IO.File]::ReadAllText($paths[$c.K])).Contains($c.V)){throw "Post-write check failed for $($c.K)"}}
} catch {
 foreach($k in $paths.Keys){[IO.File]::WriteAllBytes($paths[$k],$bytes[$k])}
 throw "Patch failed; originals restored. $($_.Exception.Message)"
}
Write-Host "All source checks passed. Modified only the three intended frontend files." -ForegroundColor Green
$tsc=Join-Path $frontend "node_modules\.bin\tsc.cmd"
if((Test-Path (Join-Path $frontend "tsconfig.json")) -and (Test-Path $tsc)){
 Push-Location $frontend
 try { & $tsc --noEmit --pretty false; if($LASTEXITCODE -eq 0){Write-Host "TypeScript passed." -ForegroundColor Green}else{Write-Host "TypeScript reports project errors; inspect output above." -ForegroundColor Yellow} }
 finally { Pop-Location }
} else { Write-Host "TypeScript check skipped; local tsc or tsconfig missing." -ForegroundColor Yellow }
