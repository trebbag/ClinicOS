export async function GET(): Promise<Response> {
  return Response.json({
    ok: true,
    service: "clinic-os-web",
    checkedAt: new Date().toISOString()
  });
}
