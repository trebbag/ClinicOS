import type { ClinicApiService } from "../lib/services";
import type { ActorContext, ResolvedIdentity } from "@clinic-os/domain";
import type { IdentityResolver } from "../lib/auth";
import type { DeviceProfileAuthService } from "../lib/deviceAuth";

declare module "fastify" {
  interface FastifyInstance {
    clinicService: ClinicApiService;
    deviceAuthService: DeviceProfileAuthService;
    identityResolver: IdentityResolver;
    databaseReadyCheck: () => Promise<boolean>;
  }

  interface FastifyRequest {
    clinicActor?: ActorContext;
    resolvedIdentity?: ResolvedIdentity;
  }
}
