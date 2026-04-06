export type BucketName = "reliability" | "throughput" | "safety_compliance" | "team_behavior";

export type ScorecardFormula = {
  bucket: BucketName;
  key: string;
  description: string;
};
