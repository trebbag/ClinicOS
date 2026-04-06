import { buildApp } from "./app";
import { assertProductionConfig } from "./env";

async function main() {
  assertProductionConfig();
  const app = buildApp();
  const port = Number(process.env.PORT ?? 4000);

  await app.listen({
    host: "0.0.0.0",
    port
  });

  app.log.info({
    msg: "Clinic OS API listening",
    port,
    authMode: process.env.AUTH_MODE ?? "dev_headers",
    publicAppOrigin: process.env.PUBLIC_APP_ORIGIN ?? null,
    microsoftIntegrationMode: process.env.MICROSOFT_INTEGRATION_MODE ?? "stub"
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
