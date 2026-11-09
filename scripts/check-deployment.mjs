import { readFileSync } from "node:fs";
import { parse } from "jsonc-parser";

const errors = [];
const config = parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"), errors);
const database = config?.d1_databases?.find((entry) => entry.binding === "DB");
if (
  errors.length ||
  !database?.database_id ||
  database.database_id === "00000000-0000-0000-0000-000000000000"
) {
  console.error(
    "Deployment needs a real D1 database ID. Follow docs/DEPLOYMENT.md: create the database, update wrangler.jsonc, and apply remote migrations before deploying.",
  );
  process.exitCode = 1;
}
