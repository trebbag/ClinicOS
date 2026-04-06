type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function StatCard({ label, value, helper }: StatCardProps): JSX.Element {
  return (
    <div className="card">
      <div className="muted">{label}</div>
      <div style={{ fontSize: "2rem", fontWeight: 700, marginTop: 8 }}>{value}</div>
      {helper ? <div className="muted" style={{ marginTop: 8 }}>{helper}</div> : null}
    </div>
  );
}
