import { execSync } from "child_process";
import path from "path";

const target = {
  name: "vedant-test",
  slug: "vedant-test",
  deployment: "proper-butterfly-725",
};

const MANAGEMENT_TOKEN =
  process.env.CONVEX_MANAGEMENT_TOKEN ||
  "eyJ2MiI6ImM4NDRkMTVlZTFmODQxNGI5NmUyM2IyNTAyMDQxZjEyIn0=";
const ENCRYPTION_KEY =
  process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY_V1 ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const POS_DEFAULT_DIR = path.resolve("pos-default");
const CONVEX_BIN = path.join(POS_DEFAULT_DIR, "node_modules/.bin/convex");

async function deploySingleStore() {
  console.log(`================================================================`);
  console.log(`Deploying latest backend changes ONLY to: ${target.name} (${target.deployment})`);
  console.log(`URL: https://${target.deployment}.convex.cloud`);
  console.log(`================================================================\n`);

  try {
    // 1. Generate Deploy Key
    console.log("Generating deployment deploy key...");
    const keyRes = await fetch(
      `https://api.convex.dev/v1/deployments/${target.deployment}/create_deploy_key`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MANAGEMENT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `deploy-updated-backend-${Date.now()}`,
          allowedActions: ["deployment:deploy", "deployment:env:write"],
        }),
      }
    );

    const keyData = await keyRes.json();
    if (!keyData.deployKey) {
      throw new Error(keyData.message || keyData.error || "Failed to create deploy key");
    }

    const env = {
      ...process.env,
      PATH: `${path.join(POS_DEFAULT_DIR, "node_modules/.bin")}:${process.env.PATH || ""}`,
      CONVEX_DEPLOY_KEY: keyData.deployKey,
    };

    // 2. Set encryption key if not already set
    try {
      console.log("Ensuring PAYMENT_GATEWAY_ENCRYPTION_KEY_V1 is configured...");
      execSync(`"${CONVEX_BIN}" env set PAYMENT_GATEWAY_ENCRYPTION_KEY_V1 ${ENCRYPTION_KEY}`, {
        cwd: POS_DEFAULT_DIR,
        env,
        encoding: "utf-8",
        stdio: "ignore",
      });
    } catch {
      // non-fatal if already set
    }

    // 3. Deploy Convex Backend
    console.log("Deploying convex functions and schema to proper-butterfly-725...");
    const deployOut = execSync(`"${CONVEX_BIN}" deploy`, {
      cwd: POS_DEFAULT_DIR,
      env,
      encoding: "utf-8",
    });
    console.log(deployOut);

    console.log(`✔ SUCCESS: ${target.name} (${target.deployment}) deployed cleanly.`);
  } catch (err) {
    console.error(`❌ FAILED: ${err.message}`);
    process.exit(1);
  }
}

deploySingleStore();
