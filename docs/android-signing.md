# Android signing and in-place updates

## Why updates can fail

Android installs an update over an existing app only when all three of these hold:

| Condition | If it fails |
| --- | --- |
| Same application id (`com.flipvault.pro`) | Two separate apps, two icons |
| Same signing certificate as the installed copy | "App not installed" — the only cure is uninstalling |
| Higher `versionCode` than the installed one | "App not installed" |

The certificate is the strict one. Android will never let an APK signed by a different key replace an installed app, because that is how it protects the app's data from an impostor.

## What went wrong with the original previews

The original workflow published `assembleDebug` output. Each fresh GitHub-hosted runner generated its own `~/.android/debug.keystore`, and those temporary private keys were never saved. The published previews therefore have different signing identities even though they all use `com.flipvault.pro`.

An APK contains the **public certificate**, not the private key. Extracting the certificate from an old APK cannot recover the key, and Android's key-rotation mechanism requires authorisation from the old key. So those previews cannot be updated in place by any newly generated key.

## Current release policy

- One persistent release keystore, supplied from GitHub Actions secrets. It is never committed to the repository.
- Its public SHA-256 certificate fingerprint is pinned in the `FLIPVAULT_ANDROID_CERT_SHA256` repository variable.
- The keystore's private-key entry is checked against the pin **before** building.
- The finished APK is verified with Android `apksigner` against the same pin **before** publishing.
- Missing configuration: an unsigned, non-installable verification artifact only. No release is published.
- Partial, invalid or changed configuration: the build fails. No substitute key is generated, and debug signing is never used as a fallback.
- The decoded keystore exists only for the duration of the job, with private file permissions, and is deleted afterwards. It never enters Git, artifacts, releases or caches.

The workflow compiles instrumentation tests but does not run an on-device upgrade test. Installation and update verification remain a separate, manual step.

## Rotating to a new signing key

Rotation is only needed to move to a key that has never left your own machine. A new key is a **new signing identity**: any phone that has the app installed with the old key needs one uninstall before the new-key build will install. Rotate before installing, so that uninstall only ever happens once.

### 1. Create the key in a private Codespace

Use a private **GitHub Codespace** belonging to this repository's owner. Codespaces consume GitHub quota; check your account's limits first.

```sh
mkdir -p ~/flipvault-signing && cd ~/flipvault-signing
keytool -genkeypair -v \
  -keystore flipvault-release.p12 -storetype PKCS12 -alias flipvault \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass 'YOUR_STORE_PASSWORD' -keypass 'YOUR_KEY_PASSWORD' \
  -dname "CN=FlipVault Pro, OU=Android, O=FlipVault, L=Delhi, ST=Delhi, C=IN"
```

If `keytool` is missing, install a JDK first: `sudo apt-get update && sudo apt-get install -y openjdk-17-jdk-headless`.

Read the certificate fingerprint that GitHub must be told about:

```sh
keytool -list -v -keystore flipvault-release.p12 -alias flipvault \
  -storepass 'YOUR_STORE_PASSWORD' | grep -i sha256
```

The output looks like `SHA256: 1C:98:BB:…`. Remove the colons to get the 64-character value.

Turn the keystore into the text GitHub stores:

```sh
base64 -w0 flipvault-release.p12
```

### 2. Back the key up before deleting the Codespace

Download `flipvault-release.p12` from the Codespace's file explorer and keep it somewhere permanent and private. Save both passwords in a password manager. **If this file is lost, every future update requires an uninstall.** Never upload it to the repository, an issue, a pull request or any public place.

### 3. Update the GitHub configuration

Under **Settings → Secrets and variables → Actions**, update the existing entries (do not create duplicates):

| Secret | Value |
| --- | --- |
| `FLIPVAULT_ANDROID_KEYSTORE_BASE64` | The `base64 -w0` output, complete |
| `FLIPVAULT_ANDROID_STORE_PASSWORD` | Keystore password |
| `FLIPVAULT_ANDROID_KEY_ALIAS` | `flipvault` (or the alias you chose) |
| `FLIPVAULT_ANDROID_KEY_PASSWORD` | Key password |

Then update the variable:

| Variable | Value |
| --- | --- |
| `FLIPVAULT_ANDROID_CERT_SHA256` | The fingerprint with colons removed |

### 4. Build and confirm

Run **Actions → Verify app & publish only persistently signed Android releases → Run workflow** on `main`. When it finishes, download `FlipVault-Pro-signing-certificate.sha256` from the new release: it must equal the fingerprint from step 1. If it does, the rotation worked.

Releases published with the retired key can no longer update the app and should be deleted to avoid confusion.

## Verifying continuity by hand

Before changing any signing setting, compare the intended keystore's certificate with the certificate of the APK that is actually installed:

```sh
keytool -list -v -keystore /secure/path/flipvault-release.p12 -alias flipvault
apksigner verify --verbose --print-certs installed-version.apk
```

Both `SHA256` values must match. **Stop if they differ.** Do not change the pinned fingerprint to make a mismatched keystore pass — a pin only proves identity when it was chosen to match the intended installed identity.

## Local builds

`android/app/build.gradle` reads the same four values from the environment (`FLIPVAULT_ANDROID_KEYSTORE_PATH`, `FLIPVAULT_ANDROID_STORE_PASSWORD`, `FLIPVAULT_ANDROID_KEY_ALIAS`, `FLIPVAULT_ANDROID_KEY_PASSWORD`) through your own secret manager. Without them, Gradle produces an unsigned release — it never generates a replacement signing identity.

## Optional side-by-side test build

A separately named **FlipVault Preview** app (`com.flipvault.pro.preview`) can be built with `-PflipvaultSideBySidePreview=true` using the dedicated preview workflow (manual dispatch only). It is a debug-signed build for testing a change next to an existing install: it is not the main app, does not replace it, does not share its storage, and is not an update channel. Its workflow verifies the separate package id before publishing.
