import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeFingerprint,
  signingConfiguration,
  verifyKeytoolCertificate,
  verifyApkCertificate,
} from "../scripts/android-signing.mjs";
const fingerprint = "AB".repeat(32),
  other = "CD".repeat(32);
const env = {
  FLIPVAULT_ANDROID_KEYSTORE_BASE64: Buffer.alloc(200, 42).toString("base64"),
  FLIPVAULT_ANDROID_STORE_PASSWORD: "test-only",
  FLIPVAULT_ANDROID_KEY_ALIAS: "test",
  FLIPVAULT_ANDROID_KEY_PASSWORD: "test-only",
  FLIPVAULT_ANDROID_CERT_SHA256: fingerprint,
};
test("no signing secrets disables publication; partial config fails rather than generating a key", () => {
  assert.equal(signingConfiguration({}), null);
  assert.throws(
    () => signingConfiguration({ FLIPVAULT_ANDROID_KEY_ALIAS: "test" }),
    /Incomplete/,
  );
  assert.equal(signingConfiguration(env).fingerprint, fingerprint);
});
test("reject malformed pins and damaged keystore encodings", () => {
  assert.equal(normalizeFingerprint("ab:".repeat(31) + "ab"), fingerprint);
  assert.throws(() => normalizeFingerprint("abcd"), /SHA-256/);
  for (const value of [
    "***",
    "AA==",
    "abcd=",
    env.FLIPVAULT_ANDROID_KEYSTORE_BASE64.slice(1),
  ])
    assert.throws(() =>
      signingConfiguration({
        ...env,
        FLIPVAULT_ANDROID_KEYSTORE_BASE64: value,
      }),
    );
});
test("keystore must have a private key and the pinned certificate", () => {
  const text = `Entry type: PrivateKeyEntry\nCertificate fingerprints:\n SHA256: ${fingerprint}`;
  assert.doesNotThrow(() => verifyKeytoolCertificate(text, fingerprint));
  assert.throws(() => verifyKeytoolCertificate(text, other), /does not match/);
  assert.throws(
    () =>
      verifyKeytoolCertificate(
        text.replace("PrivateKeyEntry", "trustedCertEntry"),
        fingerprint,
      ),
    /private signing key/,
  );
});
test("finished APK must have exactly one signer matching the pin", () => {
  const text = `Verifies\nSigner #1 certificate SHA-256 digest: ${fingerprint.toLowerCase()}\n`;
  assert.doesNotThrow(() => verifyApkCertificate(text, fingerprint));
  assert.throws(() => verifyApkCertificate(text, other), /does not match/);
  assert.throws(() =>
    verifyApkCertificate(
      text + `Signer #2 certificate SHA-256 digest: ${fingerprint}\n`,
      fingerprint,
    ),
  );
  assert.throws(() => verifyApkCertificate("unsigned", fingerprint));
});
test("main-app CI publishes only the certificate-verified release APK, never disposable debug output", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/build.yml", import.meta.url),
    "utf8",
  );
  assert.ok(workflow.includes("node scripts/android-signing.mjs verify-apk"));
  assert.ok(
    workflow.includes("if: steps.signing.outputs.configured == 'true'"),
  );
  assert.ok(workflow.includes("app-release.apk"));
  assert.ok(workflow.includes("branches: [main, arena/9d3bad6a-pdf-reader]"));
  assert.ok(
    workflow.includes("FlipVault-Pro-Android-signed-${{ github.ref_name }}"),
  );
  assert.ok(workflow.includes("github.ref == 'refs/heads/main'"));
  assert.ok(!workflow.includes("app-debug.apk"));
  assert.ok(!workflow.includes("assembleDebug :app:assembleDebugAndroidTest"));
  assert.ok(
    workflow.indexOf("Independently verify APK signing certificate") <
      workflow.indexOf("Publish verified signed release"),
  );
});
