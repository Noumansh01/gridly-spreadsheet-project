import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync(".gridly", { recursive: true });

writeFileSync(
  ".gridly/reset-fixtures.txt",
  "Gridly fixtures reset successfully.\n",
);

console.log("Gridly fixture reset complete.");
