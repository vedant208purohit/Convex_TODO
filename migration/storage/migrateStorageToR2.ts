import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

type ValidTable =
  | "all"
  | "organizations"
  | "items"
  | "customizationItems"
  | "organizationCarouselScreens";

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const rawTable = process.argv.find((arg) => arg.startsWith("--table="))?.split("=")[1] || "all";
  const validTables: ValidTable[] = [
    "all",
    "organizations",
    "items",
    "customizationItems",
    "organizationCarouselScreens",
  ];
  const tableArg: ValidTable = validTables.includes(rawTable as ValidTable)
    ? (rawTable as ValidTable)
    : "all";

  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    process.env.CONVEX_URL ||
    "https://gregarious-chicken-229.convex.cloud";

  console.log("=================================================");
  console.log("Convex Storage → Cloudflare R2 Migration Runner");
  console.log("=================================================");
  console.log(`Convex URL: ${convexUrl}`);
  console.log(`Mode:       ${isDryRun ? "DRY RUN (Read-Only)" : "REAL MIGRATION (Physical Copy)"}`);
  console.log(`Table:      ${tableArg}`);
  if (limit) console.log(`Batch Limit: ${limit}`);
  console.log("=================================================\n");

  const client = new ConvexHttpClient(convexUrl);

  try {
    const result = await client.action(api.migrateStorageToR2.migrateStorageToR2, {
      dryRun: isDryRun,
      table: tableArg,
      limit,
    });

    console.log("MIGRATION REPORT SUMMARY:");
    console.log(`- Total Candidates Found:     ${result.totalCandidates}`);
    console.log(`- Successfully Migrated:       ${result.successfullyMigrated}`);
    console.log(`- Already Migrated (Skipped):  ${result.alreadyMigrated}`);
    console.log(`- Missing Storage Objects:     ${result.missingStorageObjects}`);
    console.log(`- Oversized Files (Rejected):  ${result.oversizedFiles}`);
    console.log(`- Failed:                      ${result.failed}`);
    console.log(`- Has More Records:            ${result.hasMore ? "YES" : "NO"}`);
    if (result.nextCursor) {
      console.log(`- Next Cursor:                 ${result.nextCursor}`);
    }

    console.log("\nDETAILED ITEMS:");
    for (const item of result.items) {
      const statusIcon =
        item.status === "migrated"
          ? "✅"
          : item.status === "already_migrated"
          ? "⏭️"
          : item.status === "dry_run_candidate"
          ? "🔍"
          : "❌";
      console.log(
        `${statusIcon} [${item.table}] Record: ${item.recordId} | Field: ${item.legacyField} -> ${item.targetField} | Storage: ${item.storageId} | Status: ${item.status}`
      );
      if (item.assetId) console.log(`   -> Asset ID: ${item.assetId} | Key: ${item.storageKey}`);
      if (item.reason) console.log(`   -> Details: ${item.reason}`);
    }

    console.log("\n=================================================");
    console.log(
      isDryRun
        ? "DRY RUN COMPLETED. No database mutations or R2 uploads occurred."
        : "MIGRATION BATCH COMPLETED."
    );
    console.log("=================================================");
  } catch (error: unknown) {
    console.error("Migration execution failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
