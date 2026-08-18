import type { ApiClient } from "./types";
import { HttpApiClient } from "./http-api-client";
import { MockApiClient } from "./mock-api-client";

const apiMode = typeof __APP_API_MODE__ === "undefined" ? "mock" : __APP_API_MODE__;
const apiUrl = typeof __APP_API_URL__ === "undefined" ? "/api" : __APP_API_URL__;

export const apiClient: ApiClient =
  apiMode === "remote" ? new HttpApiClient(apiUrl) : new MockApiClient();

export * from "./api-error";
export * from "./types";
