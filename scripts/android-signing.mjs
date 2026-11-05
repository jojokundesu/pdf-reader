import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const signingVariables = [
  "FLIPVAULT_ANDROID_KEYSTORE_BASE64",
  "FLIPVAULT_ANDROID_STORE_PASSWORD",
  "FLIPVAULT_ANDROID_KEY_ALIAS",
  "FLIPVAULT_ANDROID_KEY_PASSWORD",
  "FLIPVAULT_ANDROID_CERT_SHA256",
];

export function normalizeFingerprint(value) {
  const normalized = String(value || "")
    .replace(/:/g, "")
    .trim()
    .toUpperCase();
  if (!/^[A-F0-9]{64}$/.test(normalized))
    throw new Error(
      "The pinned Android certificate must be a SHA-256 fingerprint (64 hexadecimal digits).",
    );
  return normalized;
}

export function signingConfiguration(env) {
  if (signingVariables.every((name) => !env[name])) return null;
  if (signingVariables.some((name) => !env[name]))
    throw new Error(
      "Incomplete Android signing configuration. Supply all four signing secrets and the FLIPVAULT_ANDROID_CERT_SHA256 repository variable. Publishing is blocked; no substitute key will be generated.",
    );
  const encoded = env.FLIPVAULT_ANDROID_KEYSTORE_BASE64.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0)
    throw new Error("The Android keystore secret is not valid base64.");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 100 || bytes.toString("base64") !== encoded)
    throw new Error(
      "The Android keystore secret is empty, truncated, or not canonical base64.",
    );
  return {
    bytes,
    alias: env.FLIPVAULT_ANDROID_KEY_ALIAS,
    fingerprint: normalizeFingerprint(env.FLIPVAULT_ANDROID_CERT_SHA256),
  };
}

export function verifyKeytoolCertificate(output, expected) {
  if (!/Entry type:\s*PrivateKeyEntry/.test(output))
    throw new Error(
      "The selected keystore entry does not contain a private signing key.",
    );
  const match = output.match(/SHA256:\s*([A-Fa-f0-9:]+)/);
  if (
    !match ||
    normalizeFingerprint(match[1]) !== normalizeFingerprint(expected)
  )
    throw new Error(
      "Android signing certificate does not match the pinned fingerprint. Publishing is blocked to prevent an incompatible update.",
    );
}

export function verifyApkCertificate(output, expected) {
  const matches = [
    ...output.matchAll(
      /^Signer #\d+ certificate SHA-256 digest:\s*([a-fA-F0-9:]+)/gm,
    ),
  ];
  if (
    matches.length !== 1 ||
    normalizeFingerprint(matches[0][1]) !== normalizeFingerprint(expected)
  )
    throw new Error(
      "The APK signer does not match the pinned Android certificate. Do not publish this APK.",
    );
}

function output(name, value) {
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

export function prepareSigning(env = process.env) {
  const config = signingConfiguration(env);
  if (!config) {
    output("configured", "false");
    console.log(
      "::notice::Signed Android publishing is disabled: no persistent signing key is configured. CI will verify an unsigned release, but will not publish an installable APK or generate a replacement signing identity. See docs/android-signing.md.",
    );
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "flipvault-signing-"));
  const path = join(dir, "release.keystore");
  try {
    writeFileSync(path, config.bytes, { mode: 0o600 });
    chmodSync(path, 0o600);
    let details;
    try {
      details = execFileSync(
        "keytool",
        [
          "-J-Duser.language=en",
          "-J-Duser.country=US",
          "-list",
          "-v",
          "-keystore",
          path,
          "-alias",
          config.alias,
          "-storepass:env",
          "FLIPVAULT_ANDROID_STORE_PASSWORD",
        ],
        { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch {
      throw new Error(
        "Cannot open the persistent Android signing key. Check the keystore, alias and credentials in GitHub Actions secrets. No fallback key will be used.",
      );
    }
    verifyKeytoolCertificate(details, config.fingerprint);
    output("keystore_path", path);
    output("configured", "true");
    console.log(
      "Persistent Android signing certificate matches the pinned fingerprint.",
    );
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

export function checkApk(path, env = process.env) {
  const expected = normalizeFingerprint(env.FLIPVAULT_ANDROID_CERT_SHA256);
  const sdk = env.ANDROID_HOME;
  if (!sdk)
    throw new Error("ANDROID_HOME must point to the installed Android SDK.");
  let details;
  try {
    details = execFileSync(
      join(sdk, "build-tools", "35.0.0", "apksigner"),
      ["verify", "--verbose", "--print-certs", resolve(path)],
      { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    throw new Error(
      "APK signature verification failed. Publishing is blocked.",
    );
  }
  verifyApkCertificate(details, expected);
  writeFileSync("FlipVault-Pro-signing-certificate.sha256", expected + "\n");
  console.log("APK signature verified against the pinned signing certificate.");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv[2] === "verify-apk") {
      if (!process.argv[3])
        throw new Error("Supply the signed release APK path.");
      checkApk(process.argv[3]);
    } else if (!process.argv[2] || process.argv[2] === "prepare")
      prepareSigning();
    else throw new Error("Use prepare or verify-apk <path>.");
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
