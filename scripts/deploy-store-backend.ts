import { runStoreDeployment } from "../lib/deployment-runner";

async function main() {
  const payloadArg = process.argv[2];
  if (!payloadArg) {
    console.error("Usage: npx tsx scripts/deploy-store-backend.ts '<JSON_PAYLOAD>'");
    process.exit(1);
  }

  let params: any;
  try {
    params = JSON.parse(payloadArg);
  } catch (err: any) {
    console.error("Failed to parse JSON payload argument:", err.message);
    process.exit(1);
  }

  console.log(`Starting background store deployment for org: ${params.name} (${params.slug})`);
  const result = await runStoreDeployment(params);

  if (!result.success) {
    console.error(`Store deployment failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`Store deployment successfully completed for org: ${params.name}`);
}

main().catch((err) => {
  console.error("Fatal error in deploy-store-backend runner:", err);
  process.exit(1);
});
