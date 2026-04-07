import type { WorkflowDefinition } from "@clinic-os/domain";
import type { ZodTypeAny } from "zod";
import { capaLifecycleDefinition } from "./definitions/capa-lifecycle";
import { committeePacketReviewDefinition } from "./definitions/committee-packet-review";
import { incidentReviewDefinition } from "./definitions/incident-review";
import { officeManagerDailyDefinition } from "./definitions/office-manager-daily";
import { policyLifecycleDefinition } from "./definitions/policy-lifecycle";
import { practiceAgreementReviewDefinition } from "./definitions/practice-agreement-review";
import { publicAssetClaimsReviewDefinition } from "./definitions/public-asset-claims-review";
import { qapiMonthlyReviewDefinition } from "./definitions/qapi-monthly-review";
import { serviceLinePackReviewDefinition } from "./definitions/service-line-pack-review";
import { staffScorecardDefinition } from "./definitions/staff-scorecard";

export type RegisteredWorkflowDefinition = WorkflowDefinition & {
  inputSchema: ZodTypeAny;
};

export const workflowRegistry = new Map<string, RegisteredWorkflowDefinition>([
  [policyLifecycleDefinition.id, policyLifecycleDefinition],
  [officeManagerDailyDefinition.id, officeManagerDailyDefinition],
  [staffScorecardDefinition.id, staffScorecardDefinition],
  [incidentReviewDefinition.id, incidentReviewDefinition],
  [capaLifecycleDefinition.id, capaLifecycleDefinition],
  [committeePacketReviewDefinition.id, committeePacketReviewDefinition],
  [qapiMonthlyReviewDefinition.id, qapiMonthlyReviewDefinition],
  [serviceLinePackReviewDefinition.id, serviceLinePackReviewDefinition],
  [practiceAgreementReviewDefinition.id, practiceAgreementReviewDefinition],
  [publicAssetClaimsReviewDefinition.id, publicAssetClaimsReviewDefinition]
]);
