/** Maintainer-run setup, never invoked by app builds or CI publication. */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeFingerprint,
  signingConfiguration,
  verifyKeytoolCertificate,
} from "./android-signing.mjs";
const repo = "jojokundesu/pdf-reader";
const pinName = "FLIPVAULT_ANDROID_CERT_SHA256";
const secretNames = [
  "FLIPVAULT_ANDROID_KEYSTORE_BASE64",
  "FLIPVAULT_ANDROID_STORE_PASSWORD",
  "FLIPVAULT_ANDROID_KEY_ALIAS",
  "FLIPVAULT_ANDROID_KEY_PASSWORD",
];

export function parseSetupOptions(args) {
  if (args.length === 0) return { mode: "setup" };
  if (args.length === 1 && args[0] === "--help") return { mode: "help" };
  if (args.length === 1 && args[0] === "--generate-only")
    return { mode: "generate" };
  if (args.length === 2 && args[0] === "--resume" && args[1])
    return { mode: "resume", directory: resolve(args[1]) };
  throw Error(
    "Use no arguments, --generate-only, --resume <private-backup-folder>, or --help.",
  );
}
function command(file, args, options = {}) {
  return execFileSync(file, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
}
function remoteConfiguration() {
  try {
    return {
      secrets: JSON.parse(
        command("gh", ["secret", "list", "--repo", repo, "--json", "name"]),
      ).map((x) => x.name),
      variables: JSON.parse(
        command("gh", ["variable", "list", "--repo", repo, "--json", "name"]),
      ).map((x) => x.name),
    };
  } catch {
    throw Error(
      "This terminal cannot administer the repository Actions settings. Use --generate-only, then enter the generated files directly in GitHub Settings. Never commit signing material or post it publicly.",
    );
  }
}
function existingPin(remote) {
  if (!remote.variables.includes(pinName)) return null;
  try {
    return normalizeFingerprint(
      command("gh", ["variable", "get", pinName, "--repo", repo]),
    );
  } catch {
    throw Error(
      "Could not verify the repository certificate pin. No signing settings were changed.",
    );
  }
}
function keyDetails(path, fields) {
  try {
    return command(
      "keytool",
      [
        "-J-Duser.language=en",
        "-J-Duser.country=US",
        "-list",
        "-v",
        "-keystore",
        path,
        "-alias",
        fields.FLIPVAULT_ANDROID_KEY_ALIAS,
        "-storepass:env",
        "FLIPVAULT_ANDROID_STORE_PASSWORD",
      ],
      { env: { ...process.env, ...fields } },
    );
  } catch {
    throw Error(
      "Cannot validate the private keystore. Check the local backup and its credentials; no replacement key was generated.",
    );
  }
}
function createBackup() {
  try {
    command("keytool", ["-help"]);
  } catch {
    throw Error(
      "Install a JDK first. In a Codespace terminal: sudo apt-get update && sudo apt-get install -y default-jdk-headless",
    );
  }
  const directory = join(
    homedir(),
    "flipvault-private-signing-backups",
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`,
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const fields = {
    FLIPVAULT_ANDROID_STORE_PASSWORD: randomBytes(32).toString("hex"),
    FLIPVAULT_ANDROID_KEY_ALIAS: "flipvault-release",
  };
  fields.FLIPVAULT_ANDROID_KEY_PASSWORD =
    fields.FLIPVAULT_ANDROID_STORE_PASSWORD;
  const keystore = join(directory, "flipvault-release.p12");
  try {
    command(
      "keytool",
      [
        "-genkeypair",
        "-noprompt",
        "-keystore",
        keystore,
        "-storetype",
        "PKCS12",
        "-alias",
        fields.FLIPVAULT_ANDROID_KEY_ALIAS,
        "-keyalg",
        "RSA",
        "-keysize",
        "3072",
        "-validity",
        "10000",
        "-dname",
        "CN=FlipVault Pro, OU=Android Release, O=FlipVault",
        "-storepass:env",
        "FLIPVAULT_ANDROID_STORE_PASSWORD",
        "-keypass:env",
        "FLIPVAULT_ANDROID_KEY_PASSWORD",
      ],
      { env: { ...process.env, ...fields } },
    );
  } catch {
    throw Error(
      `Key creation did not complete. The private directory is ${directory}. No GitHub settings were changed; inspect the local files before retrying.`,
    );
  }
  fields.FLIPVAULT_ANDROID_KEYSTORE_BASE64 =
    readFileSync(keystore).toString("base64");
  const details = keyDetails(keystore, fields),
    match = details.match(/SHA256:\s*([0-9a-fA-F:]+)/);
  if (!match)
    throw Error(
      `No certificate fingerprint found. Preserve the backup in ${directory}; no settings were uploaded.`,
    );
  fields[pinName] = normalizeFingerprint(match[1]);
  signingConfiguration(fields);
  verifyKeytoolCertificate(details, fields[pinName]);
  for (const name of [...secretNames, pinName])
    writeFileSync(join(directory, name + ".txt"), fields[name] + "\n", {
      mode: 0o600,
    });
  writeFileSync(
    join(directory, "private-setup.json"),
    JSON.stringify({ repository: repo, fields }, null, 2) + "\n",
    { mode: 0o600 },
  );
  return { directory, fields };
}
function restoreBackup(directory) {
  let state;
  try {
    state = JSON.parse(
      readFileSync(join(directory, "private-setup.json"), "utf8"),
    );
  } catch {
    throw Error(
      "Cannot read the saved private-setup.json. Resume requires the existing backup, not a new key.",
    );
  }
  if (state.repository !== repo)
    throw Error("This backup belongs to a different repository.");
  const config = signingConfiguration(state.fields);
  if (
    !config ||
    !readFileSync(join(directory, "flipvault-release.p12")).equals(config.bytes)
  )
    throw Error("Keystore and backup configuration do not match.");
  verifyKeytoolCertificate(
    keyDetails(join(directory, "flipvault-release.p12"), state.fields),
    config.fingerprint,
  );
  return { directory, fields: state.fields };
}
export function runSetup(options) {
  if (options.mode === "help") {
    console.log(
      "Creates a private release signing key. Run this in a PRIVATE GitHub Codespace or on a trusted computer, never in a public CI job.\nnode scripts/setup-android-signing.mjs                 Generate once and provision GitHub using your existing gh login\nnode scripts/setup-android-signing.mjs --generate-only  Create private files for manual GitHub Settings entry\nnode scripts/setup-android-signing.mjs --resume FOLDER  Reuse the saved key after interrupted setup\nBackups contain private credentials. Keep an encrypted offline copy; never commit or publish them. See docs/android-signing.md.",
    );
    return;
  }
  const remote = options.mode === "generate" ? null : remoteConfiguration();
  if (
    options.mode === "setup" &&
    (secretNames.some((n) => remote.secrets.includes(n)) ||
      remote.variables.includes(pinName))
  )
    throw Error(
      "Signing configuration already exists or is partially configured. Refusing to rotate the key. Use --resume with its existing private backup, or verify the existing keystore manually.",
    );
  const backup =
    options.mode === "resume"
      ? restoreBackup(options.directory)
      : createBackup();
  console.log(
    `Private backup folder: ${backup.directory}\nDo not commit or share its contents. Download the encrypted .p12 and store its passwords in a password manager before deleting this Codespace.`,
  );
  console.log(`Public certificate SHA-256: ${backup.fields[pinName]}`);
  if (options.mode === "generate") {
    console.log(
      "No GitHub settings were changed. In repository Settings → Secrets and variables → Actions, create four repository secrets using the matching .txt files, then create the certificate variable using its matching .txt file. See docs/android-signing.md.",
    );
    return;
  }
  const current = existingPin(remote);
  if (current && current !== backup.fields[pinName])
    throw Error(
      "The repository pin identifies a different key. Refusing to rotate it. Keep this backup private; restore the correct existing key instead.",
    );
  for (const name of secretNames) {
    try {
      command("gh", ["secret", "set", name, "--repo", repo], {
        input: backup.fields[name],
      });
    } catch {
      throw Error(
        `Could not provision ${name}. Private key retained in ${backup.directory}. Finish via GitHub Settings or rerun with --resume and this SAME folder. Do not generate a new key.`,
      );
    }
  }
  try {
    command("gh", [
      "variable",
      "set",
      pinName,
      "--repo",
      repo,
      "--body",
      backup.fields[pinName],
    ]);
  } catch {
    throw Error(
      `Secrets were provisioned but the public pin was not. Set ${pinName} from the saved .txt file in GitHub Variables. Do not generate a new key.`,
    );
  }
  console.log(
    "Persistent signing settings provisioned. Save your private backup, then run the main release workflow on main. This is a NEW key: it cannot update old temporary-key installs in place.",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    runSetup(parseSetupOptions(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
