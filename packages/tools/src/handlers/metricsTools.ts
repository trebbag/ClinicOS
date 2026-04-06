export async function upsertMetricRun(input: {
  metricKey: string;
  entityId: string;
  value: number;
}) {
  return {
    status: "metric_upserted",
    ...input
  };
}
