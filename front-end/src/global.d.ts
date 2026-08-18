declare const __APP_API_MODE__: "mock" | "remote";
declare const __APP_API_URL__: string;

declare module "requesterApp/RequesterRoutes" {
  import type { ComponentType } from "react";
  const RequesterRoutes: ComponentType;
  export default RequesterRoutes;
}

declare module "approverApp/ApproverRoutes" {
  import type { ComponentType } from "react";
  const ApproverRoutes: ComponentType;
  export default ApproverRoutes;
}
