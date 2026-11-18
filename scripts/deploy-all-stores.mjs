import { execSync } from "child_process";
import path from "path";

const TARGETS = [
  { name: "Gregarious Chicken (Store Template)", slug: "gregarious-chicken", deployment: "gregarious-chicken-229" },
  { name: "Mahendra Suthar", slug: "mahendra-suthar", deployment: "honorable-armadillo-176" },
  { name: "GTS", slug: "gts", deployment: "courteous-condor-216" },
  { name: "yuppp", slug: "yuppp", deployment: "fabulous-caiman-984" },
  { name: "rose", slug: "rose", deployment: "acoustic-warbler-638" },
  { name: "Hitler", slug: "hitler", deployment: "adamant-shepherd-716" },
  { name: "Vedant pro", slug: "vedant-pro", deployment: "shiny-bobcat-445" },
];

const MANAGEMENT_TOKEN = process.env.CONVEX_MANAGEMENT_TOKEN || "eyJ2MiI6IjJiNWFmZTlhMzU1NjRhZjY4NzFlMDljZGE0YjZkYTQ0In0=";
const ENCRYPTION_KEY = process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY_V1 || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const POS_DEFAULT_DIR = path.resolve("pos-default");
const CONVEX_BIN = path.join(POS_DEFAULT_DIR, "node_modules/.bin/convex");

async function deployAll() {
  console.log(`================================================================`);
  console.log(`Starting deployment of updated backend code across ${TARGETS.length} targets...`);
  console.log(`================================================================\n`);

  const results = [];

  for (let i = 0; i < TARGETS.length; i++) {
    const target = TARGETS[i];
    console.log(`----------------------------------------------------------------`);
    console.log(`[${i + 1}/${TARGETS.length}] Deploying to ${target.name} (${target.slug})`);
    console.log(`Deployment: ${target.deployment} (https://${target.deployment}.convex.cloud)`);
    console.log(`----------------------------------------------------------------`);

    try {
      // 1. Generate Deploy Key
      const keyRes = await fetch(`https://api.convex.dev/v1/deployments/${target.deployment}/create_deploy_key`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MANAGEMENT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `deploy-updated-backend-${Date.now()}`,
          allowedActions: ["deployment:deploy", "deployment:env:write"],
        }),
      });

      const keyData = await keyRes.json();
      if (!keyData.deployKey) {
        throw new Error(keyData.message || keyData.error || "Failed to create deploy key");
      }

      const env = {
        ...process.env,
        PATH: `${path.join(POS_DEFAULT_DIR, "node_modules/.bin")}:${process.env.PATH || ""}`,
        CONVEX_DEPLOY_KEY: keyData.deployKey,
      };

      // 2. Set encryption key if not already present
      try {
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
      const deployOut = execSync(`"${CONVEX_BIN}" deploy`, {
        cwd: POS_DEFAULT_DIR,
        env,
        encoding: "utf-8",
      });
      console.log(`✔ SUCCESS: ${target.name} deployed cleanly.`);
      if (deployOut) {
        const lines = deployOut.trim().split("\n");
        console.log(`  ${lines[lines.length - 1]}`);
      }
      results.push({ name: target.name, deployment: target.deployment, status: "SUCCESS" });
    } catch (err) {
      const errMsg = err.stdout || err.message || String(err);
      console.error(`❌ FAILED: ${target.name} (${target.deployment}):`, errMsg);
      results.push({ name: target.name, deployment: target.deployment, status: "FAILED", error: errMsg.slice(0, 100) });
    }
  }

  console.log(`\n================================================================`);
  console.log(`                       DEPLOYMENT SUMMARY                       `);
  console.log(`================================================================`);
  console.table(results);
}

deployAll();

