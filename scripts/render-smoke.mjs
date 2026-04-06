const baseUrl = process.env.SMOKE_BASE_URL ?? process.argv[2];

if (!baseUrl) {
  console.error("Usage: npm run smoke:render -- https://clinic-os.example.com");
  process.exit(1);
}

const checks = [
  { label: "web health", url: `${baseUrl.replace(/\/$/, "")}/healthz` },
  { label: "web readiness", url: `${baseUrl.replace(/\/$/, "")}/readyz` },
  { label: "proxied api health", url: `${baseUrl.replace(/\/$/, "")}/clinic-api/healthz` }
];

let failed = false;

for (const check of checks) {
  try {
    const response = await fetch(check.url, { redirect: "manual" });
    const payload = await response.text();
    console.log(JSON.stringify({
      label: check.label,
      url: check.url,
      status: response.status,
      ok: response.ok,
      body: payload.slice(0, 400)
    }));
    if (!response.ok) {
      failed = true;
    }
  } catch (error) {
    failed = true;
    console.log(JSON.stringify({
      label: check.label,
      url: check.url,
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }));
  }
}

if (failed) {
  process.exit(1);
}
