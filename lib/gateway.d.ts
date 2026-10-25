import { l as ServerStatus, o as GatewayStatus, r as GatewayHost } from "./gateway-contract-DtSPpa7v.js";
import z from "@deepseek-ai/schemastery";
import { Context, Service } from "@deepseek-ai/cordis";
//#region src/gateway.d.ts
/** Host-row composition defaults. */
declare const Config: z<Schemastery.ObjectS<NoInfer<{
  /** Loopback port the gateway listens on and the health probe uses. */
  port: z<number, number, "defined">;
  /** Start the gateway with the host row (and restart it after a crash). */
  autoStart: z<boolean, boolean, "defined">;
  /** Restarts allowed in one run before supervision gives up. */
  restartLimit: z<number, number, "defined">;
  /** Accounts directory; empty means '<workdir>/auths'. */
  authDir: z<string, string, "defined">;
  /** Download the pinned server automatically when it is missing. */
  autoDownload: z<boolean, boolean, "defined">;
  /** Optional HTTPS mirror for the release assets; checksums stay pinned. */
  serverBaseUrl: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  /** Loopback port the gateway listens on and the health probe uses. */
  port: z<number, number, "defined">;
  /** Start the gateway with the host row (and restart it after a crash). */
  autoStart: z<boolean, boolean, "defined">;
  /** Restarts allowed in one run before supervision gives up. */
  restartLimit: z<number, number, "defined">;
  /** Accounts directory; empty means '<workdir>/auths'. */
  authDir: z<string, string, "defined">;
  /** Download the pinned server automatically when it is missing. */
  autoDownload: z<boolean, boolean, "defined">;
  /** Optional HTTPS mirror for the release assets; checksums stay pinned. */
  serverBaseUrl: z<string, string, "defined">;
}>>, "plain">;
/** Parsed host-row config. */
interface Config {
  port: number;
  autoStart: boolean;
  restartLimit: number;
  authDir: string;
  autoDownload: boolean;
  serverBaseUrl: string;
}
/**
 * The host-owned gateway service.
 *
 * It survives a panel reload because it is a separate composition row. A host
 * row reload terminates and restarts the gateway; that is the intended
 * boundary.
 */
declare class GatewayHostService extends Service implements GatewayHost {
  static Config: z<Schemastery.ObjectS<NoInfer<{
    /** Loopback port the gateway listens on and the health probe uses. */
    port: z<number, number, "defined">;
    /** Start the gateway with the host row (and restart it after a crash). */
    autoStart: z<boolean, boolean, "defined">;
    /** Restarts allowed in one run before supervision gives up. */
    restartLimit: z<number, number, "defined">;
    /** Accounts directory; empty means '<workdir>/auths'. */
    authDir: z<string, string, "defined">;
    /** Download the pinned server automatically when it is missing. */
    autoDownload: z<boolean, boolean, "defined">;
    /** Optional HTTPS mirror for the release assets; checksums stay pinned. */
    serverBaseUrl: z<string, string, "defined">;
  }>>, Schemastery.ObjectT<NoInfer<{
    /** Loopback port the gateway listens on and the health probe uses. */
    port: z<number, number, "defined">;
    /** Start the gateway with the host row (and restart it after a crash). */
    autoStart: z<boolean, boolean, "defined">;
    /** Restarts allowed in one run before supervision gives up. */
    restartLimit: z<number, number, "defined">;
    /** Accounts directory; empty means '<workdir>/auths'. */
    authDir: z<string, string, "defined">;
    /** Download the pinned server automatically when it is missing. */
    autoDownload: z<boolean, boolean, "defined">;
    /** Optional HTTPS mirror for the release assets; checksums stay pinned. */
    serverBaseUrl: z<string, string, "defined">;
  }>>, "plain">;
  readonly serviceVersion = 1;
  private readonly owner;
  private readonly config;
  private readonly server;
  private readonly supervisor;
  private subprocess?;
  private timer?;
  private downloadPromise?;
  private started;
  constructor(ctx: Context, config: Config);
  /** The process snapshot. */
  status(): GatewayStatus;
  /** The pinned server and its local cache state. */
  serverStatus(): ServerStatus;
  start(): Promise<GatewayStatus>;
  stop(): Promise<GatewayStatus>;
  restart(): Promise<GatewayStatus>;
  /**
   * Start the download and return immediately.
   *
   * The panel polls `serverStatus()` for progress. When the download finishes,
   * an auto-start row brings the gateway up with the new binary.
   */
  downloadServer(): Promise<ServerStatus>;
  /** Abort the in-flight download. */
  cancelDownload(): void;
  /** Re-hash the installed binary. */
  verifyServer(): Promise<ServerStatus>;
  ensureConfig(): {
    path: string;
    created: boolean;
    apiKey?: string;
  };
  apiKeyFromConfig(): string | undefined;
  updateConfigApiKey(key: string): boolean;
  /** Start once the subprocess seam is available; never spawn from the panel. */
  private startIfConfigured;
}
//#endregion
export { Config, GatewayHostService as default };