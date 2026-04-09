/**
 * SSR Manager — manages independent Next.js SSR apps for stores and websites.
 *
 * Orchestrates: port allocation, PM2 processes, nginx config, and lifecycle.
 */

export {
  allocatePort,
  releaseStorePort,
  releaseWebsitePort,
  getActiveAppCount,
  MAX_CONCURRENT_APPS,
} from "./port-manager";

export {
  startApp,
  stopApp,
  restartApp,
  deleteApp,
  getAppStatus,
  listApps,
  waitForHealthy,
  type AppConfig,
  type AppStatus,
} from "./pm2-manager";

export { regenerateAndReload } from "./nginx-config";

export { stopIdleApps } from "./idle-manager";
