#!/bin/bash
# Julian's iPhone testers: builds this app for the iPhone simulator, whatever it is made with (Flutter, Expo, React Native,
# Capacitor, or Xcode itself), and leaves it at julian-build/Julian.app for the testers (core/ios.js puts this here).
set -o pipefail
OUT="$PWD/julian-build"; mkdir -p "$OUT"; LOG="$OUT/build.log"
fail() { echo "::error::$1"; [ -f "$LOG" ] && grep -E "error:|ERROR|Error:" "$LOG" | head -8; exit 1; }
deps() { [ -f package.json ] || return 0; if [ -f yarn.lock ]; then npx --yes yarn install --frozen-lockfile; elif [ -f pnpm-lock.yaml ]; then npx --yes pnpm install --frozen-lockfile; else npm ci || npm install; fi; }
pods() { for p in ios ios/App; do [ -f "$p/Podfile" ] && (cd "$p" && pod install); done; return 0; }
APP=""; WS=""; PROJ=""
if [ -f pubspec.yaml ]; then
  git clone --depth 1 -b stable https://github.com/flutter/flutter.git "$HOME/flutter" >/dev/null 2>&1 || fail "Flutter would not download"
  export PATH="$HOME/flutter/bin:$PATH"
  flutter pub get && flutter build ios --simulator --debug > "$LOG" 2>&1 || fail "The Flutter build failed"
  APP=$(ls -d build/ios/iphonesimulator/*.app 2>/dev/null | head -1)
elif [ -f app.json ] && grep -q '"expo"' app.json && [ ! -d ios ]; then
  deps || fail "Its packages would not install"
  npx expo prebuild -p ios --no-install > "$LOG" 2>&1 || fail "Expo would not make its iPhone project"
  pods || fail "Its pods would not install"
elif [ -d ios ]; then
  deps || fail "Its packages would not install"
  if [ -f capacitor.config.ts ] || [ -f capacitor.config.json ]; then npm run build --if-present && npx cap sync ios || fail "Capacitor would not sync"; fi
  pods || fail "Its pods would not install"
fi
# (a project kept as XcodeGen's project.yml: its Xcode project made first)
if [ -z "$APP" ] && [ -f project.yml ] && ! ls -d *.xcodeproj >/dev/null 2>&1; then
  brew install xcodegen >/dev/null 2>&1 && xcodegen generate > "$LOG" 2>&1 || fail "XcodeGen would not make its project"
fi
if [ -z "$APP" ]; then
  WS=$(find . -maxdepth 3 -name "*.xcworkspace" -not -path "*/Pods/*" -not -path "*.xcodeproj/*" -not -path "./node_modules/*" | head -1)
  [ -z "$WS" ] && PROJ=$(find . -maxdepth 3 -name "*.xcodeproj" -not -path "*/Pods/*" -not -path "./node_modules/*" | head -1)
  [ -z "$WS$PROJ" ] && fail "No Xcode project in it"
  if [ -n "$WS" ]; then WHAT=(-workspace "$WS"); else WHAT=(-project "$PROJ"); fi
  SCHEME=$(xcodebuild "${WHAT[@]}" -list -json 2>/dev/null | python3 -c 'import json,sys
d=json.load(sys.stdin); x=d.get("workspace") or d.get("project") or {}
s=[n for n in x.get("schemes",[]) if not n.startswith("Pods") and "Tests" not in n]
print(s[0] if s else "")')
  if [ -n "$SCHEME" ]; then
    xcodebuild "${WHAT[@]}" -scheme "$SCHEME" -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath "$OUT/dd" CODE_SIGNING_ALLOWED=NO build > "$LOG" 2>&1 || fail "The Xcode build failed"
    APP=$(find "$OUT/dd/Build/Products" -maxdepth 2 -name "*.app" -path "*iphonesimulator*" | head -1)
  else
    xcodebuild "${WHAT[@]}" -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO SYMROOT="$OUT/sym" build > "$LOG" 2>&1 || fail "The Xcode build failed"
    APP=$(find "$OUT/sym" -maxdepth 2 -name "*.app" -path "*iphonesimulator*" | head -1)
  fi
fi
[ -z "$APP" ] && fail "The build made no app"
rm -rf "$OUT/Julian.app" && cp -R "$APP" "$OUT/Julian.app" && echo "APP=$OUT/Julian.app" >> "$GITHUB_ENV"
echo "Built: $APP"
