import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSetupOptions } from "../scripts/setup-android-signing.mjs";
test("signing helper has explicit setup, generate-only and same-key recovery modes", () => {
  assert.equal(parseSetupOptions([]).mode, "setup");
  assert.equal(parseSetupOptions(["--generate-only"]).mode, "generate");
  assert.equal(
    parseSetupOptions(["--resume", "/tmp/private-backup"]).directory,
    "/tmp/private-backup",
  );
  assert.throws(() => parseSetupOptions(["--resume"]));
  assert.throws(() => parseSetupOptions(["--force-rotate"]));
});
test("private signing setup is not invoked by either build workflow", () => {
  for (const name of ["build.yml", "side-by-side-preview.yml"]) {
    const yaml = readFileSync(
      new URL("../.github/workflows/" + name, import.meta.url),
      "utf8",
    );
    assert.ok(!yaml.includes("setup-android-signing.mjs"));
  }
});
test("disposable download has explicit package isolation and publication guard", () => {
  const yaml = readFileSync(
    new URL("../.github/workflows/side-by-side-preview.yml", import.meta.url),
    "utf8",
  );
  assert.ok(yaml.includes("-PflipvaultSideBySidePreview=true"));
  assert.ok(yaml.includes("package: name='com.flipvault.pro.preview'"));
  assert.ok(
    yaml.indexOf("Verify this APK") < yaml.indexOf("Publish requested preview"),
  );
  const gradle = readFileSync(
    new URL("../android/app/build.gradle", import.meta.url),
    "utf8",
  );
  assert.ok(
    gradle.includes('"com.flipvault.pro.preview" : "com.flipvault.pro"'),
  );
});
