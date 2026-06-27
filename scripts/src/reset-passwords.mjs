/**
 * Reset all center and super-admin passwords against DATABASE_URL.
 *
 * Run from the PROJECT ROOT:
 *   node --env-file-if-exists=.env artifacts/api-server/node_modules/.bin/../../../node_modules/.bin/..
 *
 * Actually just follow the README instructions — run via pnpm:
 *   pnpm --filter @workspace/api-server run reset-passwords
 */
console.log("Use: pnpm --filter @workspace/api-server run reset-passwords");
