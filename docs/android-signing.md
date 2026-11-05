# Android signing and in-place updates

## What went wrong with the original previews

The original workflow published `assembleDebug` output. Each fresh GitHub-hosted runner generated its own `~/.android/debug.keystore`. The workflow neither restored a persistent key nor saved those temporary private keys. Consequently, the published APKs can have different signing identities even though they all use `com.flipvault.pro`.

That was a build/release configuration error, not something a reader should need to work around for every update.

Android accepts an in-place update when the package ID and signing identity are compatible and the version code is not a downgrade. FlipVault keeps `com.flipvault.pro`, and the signing correction reserved version code **3** / version name **1.1.1**. The recorded-audio update now uses version code **4** / version name **1.2.0**. Future releases must increase the version code as well as preserve the signing identity.

An APK contains the **public certificate**, not the private signing key. Downloading or extracting the certificate from an old APK cannot recover the key. Android signing-key rotation also needs authorization from the old key; it does not bypass this requirement.

If the private key for a particular installed preview exists in a separate backup, configure **that exact key**. If it does not exist, no newly generated key can produce an in-place update for that installation. Do not uninstall a working app just to troubleshoot signing.

## Corrected release policy

- Never publish **main-app** debug APKs from disposable runner keys. The explicitly requested side-by-side test exception below uses a different package ID.
- Use one privately retained release keystore, supplied from protected GitHub Actions secrets.
- Pin its public SHA-256 signing-certificate fingerprint independently in a repository variable.
- Check the keystore's private-key entry and pinned certificate **before** building.
- Verify the finished APK with Android `apksigner` and check its signer against the same pin **before** publishing.
- Missing configuration: build an **unsigned, non-installable** verification artifact only. No installable APK or Android GitHub Release is published.
- Partial, invalid or changed configuration: fail closed. Never silently create a substitute signing key, fall back to debug signing, or change the fingerprint pin.
- Temporary decoded keystores are written with private file permissions on the runner and deleted after the job. They are not put in Git, artifacts, release assets or caches. The persistent source is the protected secret plus the maintainer's independent offline backup.

The workflow compiles instrumentation tests but does not run an on-device upgrade test. Actual installation/update verification remains a separate step.

## Fastest setup from an Android phone (no PC required)

Use a private **GitHub Codespace**, not the public repository, this chat, or an Actions job, to create the permanent key. Codespaces can consume GitHub quota; check your account's limits before creating one.

1. On GitHub, open this repository and select branch **`arena/80cef757-pdf-reader`**. Choose **Code → Codespaces → Create codespace** (on a phone, the browser's desktop-site mode can help).
2. In its terminal run:
   ```sh
   node scripts/setup-android-signing.mjs
   ```
   This uses the Codespace's existing GitHub CLI login, checks for an existing configuration, creates a private RSA keystore only once, saves private recovery files **outside the repository**, and attempts to provision the four secrets and the public certificate pin. It never prints the private key or passwords. **Do not run this if you have an original signing-key backup you want to preserve; configure that existing key instead.**
3. If it says a JDK is missing, run the printed JDK installation command, then retry. If GitHub denies secret administration **before a private backup folder is created**, run:
   ```sh
   node scripts/setup-android-signing.mjs --generate-only
   ```
   No GitHub permissions or access tokens need to be sent in chat. The helper prints the path of a private folder, not its secret contents. If the first attempt already printed a private backup folder, use those existing files or `--resume` instead: do not generate another key after a partially completed upload.
4. In the Codespace choose **File → Open Folder**, open that printed folder, and use Explorer to open/download the needed files. In GitHub **Settings → Secrets and variables → Actions → Secrets → New repository secret**, create the four names in the table below. Paste the contents of each matching `.txt` file into its secret field. Then use **Variables → New repository variable** to create `FLIPVAULT_ANDROID_CERT_SHA256` from its matching file. The keystore Base64 must be copied in full. Do not commit these files or paste them into an issue, pull request, or chat.
5. **Before deleting the Codespace**, download `flipvault-release.p12`, securely save its passwords in a password manager, and retain an encrypted offline recovery copy. The generated folder includes plaintext credential files for setup: treat the entire folder as sensitive. Do not put it in a public cloud folder or repository.
6. Open **Actions → Verify app & publish only persistently signed Android releases → Run workflow** and select `arena/80cef757-pdf-reader`. If GitHub has not indexed the manual workflow on this non-default branch, run this in the same authenticated Codespace terminal:
   ```sh
   gh workflow run build.yml --ref arena/80cef757-pdf-reader
   ```
   If GitHub refuses dispatch before the workflow exists on the default branch, tell the coding agent **“signing configured”** (without sending any values). The agent can trigger a normal push build on the existing working branch; no merge or signing-check removal is required. Once the main build succeeds, a `signed-…` release contains `FlipVault-Pro-Android.apk` and its public certificate fingerprint.

If setup was interrupted **after** it created a key, do not generate another one. Use:

```sh
node scripts/setup-android-signing.mjs --resume /path/to/the/saved/private/folder
```

The helper refuses to overwrite a different certificate pin or silently rotate an existing configuration. The `--generate-only` mode cannot inspect GitHub settings; if any signing settings already exist, compare the fingerprints and restore the original backup rather than uploading a replacement.

## Requested side-by-side download exception

A separately named **FlipVault Preview** app (`com.flipvault.pro.preview`) can be built explicitly with `-PflipvaultSideBySidePreview=true` by the dedicated preview workflow. This is a temporary debug-signed download requested for testing the latest audio. It is **not** the main app, does not replace it, does not automatically share its storage, and does not promise in-place preview updates. Its workflow verifies the separate package ID before publishing. Main-app permanent-signing checks remain unchanged.

## Maintainer setup (GitHub settings, never chat)

The current repository integration cannot administer Actions secrets. A repository administrator must configure these directly under **Settings → Secrets and variables → Actions**. Do not paste keys, passwords, base64 keystores or tokens into an issue, pull request, commit, workflow log, or chat.

Add these four **repository secrets**:

| Secret | Value |
| --- | --- |
| `FLIPVAULT_ANDROID_KEYSTORE_BASE64` | Base64-encoded persistent JKS or PKCS#12 keystore, with no wrapping |
| `FLIPVAULT_ANDROID_STORE_PASSWORD` | Keystore password |
| `FLIPVAULT_ANDROID_KEY_ALIAS` | Alias of the private signing-key entry |
| `FLIPVAULT_ANDROID_KEY_PASSWORD` | Password for that private key |

Add this **repository variable** (the fingerprint is public, not a credential):

| Variable | Value |
| --- | --- |
| `FLIPVAULT_ANDROID_CERT_SHA256` | SHA-256 fingerprint of the intended signing certificate; 64 hex digits, optionally separated by colons |

To preserve an existing installation, first compare the intended keystore's certificate with **that installed version's APK** on a trusted local machine:

```sh
# Prompts locally for the keystore password; does not put it in shell history.
keytool -list -v -keystore /secure/path/flipvault-release.jks -alias YOUR_ALIAS

# Use Android SDK build-tools apksigner on the APK corresponding to the installed app.
apksigner verify --verbose --print-certs installed-version.apk
```

The keystore's `SHA256` certificate fingerprint must match the APK's signer certificate digest. **Stop if they differ.** Do not merely change the pinned fingerprint to make a mismatched keystore pass. A pin proves identity continuity only when it was chosen to match the intended installed signing identity.

If you have the correct key, encode it locally and enter the result only into the GitHub secret field. Keep a separate, encrypted offline backup of the original keystore and its recovery information. The workflow only reads existing secrets; it cannot create, recover or back up the signing identity for you.

For local builds, use the same four `FLIPVAULT_ANDROID_*` signing values expected in `android/app/build.gradle` (`KEYSTORE_PATH`, `STORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) through your trusted local secret manager. Without those values Gradle creates an unsigned release, never a replacement signing identity. CI additionally requires `KEYSTORE_BASE64` and the certificate pin and runs independent pre/post-signing verification.

## If the original temporary private key is unavailable

There is no compatible APK update that this pipeline can produce for that old identity. Keep the old app installed while you prepare a safe migration:

1. Export a FlipVault vault backup from the old app, save it outside app storage, and retain the original PDFs.
2. Establish and back up a permanent signing key privately. It will be a **new** application signing identity, not a repair of the old one.
3. Configure the secrets/pin and publish a verified signed release. Do not uninstall before a usable replacement and your backups are available.
4. Only if Android rejects that replacement as an in-place update, uninstall the old preview, install the signed app, restore the vault, and re-import the same PDFs. Matching hashes reattach notes and reading positions.
5. All subsequent updates must reuse this permanent key. Test an actual old-to-new install before distributing future releases.

This is a legacy migration limitation of the already published previews. It is not the intended update process going forward. Native app data should remain intact through normal compatible in-place updates; external backups are still strongly recommended.
