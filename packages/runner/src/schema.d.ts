/**
 * Configurations for a single canister.
 */
// export type CanisterConfiguration = { args?: [] }
//   & (RustSpecificProperties
//   | AssetSpecificProperties
//   | CustomSpecificProperties
//   | MotokoSpecificProperties)
export type CanisterConfiguration = { args?: [] }
  & CustomSpecificProperties
/**
 * Path of this canister's candid interface declaration.
 */
export type CandidFile = string
/**
 * Name of the rust package that compiles to this canister's WASM.
 */
export type PackageName = string
/**
 * Folders from which assets are uploaded.
 */
export type AssetSourceFolder = string[]
/**
 * Commands that are executed in order to produce this canister's WASM module. Expected to produce the WASM in the path specified by the 'wasm' field.
 */
export type BuildCommands = SerdeVecFor_String
export type SerdeVecFor_String = string | string[]
/**
 * Path to this canister's candid interface declaration.
 */
export type CandidFile1 = string
/**
 * Path to WASM to be installed.
 */
export type WASMPath = string
export type EnableBitcoinAdapter = boolean
/**
 * The logging level of the adapter.
 */
export type LoggingLevel = LoggingLevel1 & LoggingLevel2
export type LoggingLevel1 = BitcoinAdapterLogLevel
/**
 * Represents the log level of the bitcoin adapter.
 */
export type BitcoinAdapterLogLevel =
  | "critical"
  | "error"
  | "warning"
  | "info"
  | "debug"
  | "trace"
export type LoggingLevel2 = string
/**
 * Addresses of nodes to connect to (in case discovery from seeds is not possible/sufficient).
 */
export type AvailableNodes = string[] | null
export type EnableHTTPAdapter = boolean
/**
 * Determines the subnet type the replica will run as. Affects things like cycles accounting, message size limits, cycle limits. Defaults to 'application'.
 */
export type SubnetType = ReplicaSubnetType | null
export type ReplicaSubnetType = "system" | "application" | "verifiedapplication"
/**
 * Pins the dfx version for this project.
 */
export type DfxVersion = string | null
export type ConfigNetwork =
  | CustomNetworkConfiguration
  | LocalReplicaConfiguration1
/**
 * Type 'ephemeral' is used for networks that are regularly reset. Type 'perstistent' is used for networks that last for a long time and where it is preferred that canister IDs get stored in source control.
 */
export type NetworkType = "ephemeral" | "persistent"
export type Profile = "Debug" | "Release"

export interface DfxJson {
  /**
   * Mapping between canisters and their settings.
   */
  canisters?: {
    [k: string]: CanisterConfiguration
  } | ((deploy: () => void) => Promise<void>) | null
  /**
   * Defaults for dfx start.
   */
  defaults?: ConfigDefaults | null
  dfx?: DfxVersion
  /**
   * Mapping between network names and their configurations. Networks 'ic' and 'local' are implicitly defined.
   */
  networks?: {
    [k: string]: ConfigNetwork
  } | null
  profile?: Profile | null
  /**
   * Used to keep track of dfx.json versions.
   */
  version?: number | null

  [k: string]: unknown
}

export interface RustSpecificProperties {
  candid: CandidFile
  package: PackageName
  type: "rust"

  [k: string]: unknown
}

export interface AssetSpecificProperties {
  source: AssetSourceFolder
  type: "assets"

  [k: string]: unknown
}

export interface CustomSpecificProperties {
  build: BuildCommands
  candid: CandidFile1
  type: "custom"
  wasm: WASMPath

  [k: string]: unknown
}

export interface MotokoSpecificProperties {
  type: "motoko"

  [k: string]: unknown
}

/**
 * Defaults to use on dfx start.
 */
export interface ConfigDefaults {
  bitcoin?: BitcoinAdapterConfiguration | null
  bootstrap?: BootstrapServerConfiguration | null
  build?: BuildProcessConfiguration | null
  canister_http?: HTTPAdapterConfiguration | null
  replica?: LocalReplicaConfiguration | null

  [k: string]: unknown
}

export interface BitcoinAdapterConfiguration {
  enabled?: EnableBitcoinAdapter
  log_level?: LoggingLevel
  nodes?: AvailableNodes

  [k: string]: unknown
}

export interface BootstrapServerConfiguration {
  /**
   * Specifies the IP address that the bootstrap server listens on. Defaults to 127.0.0.1.
   */
  ip?: string | null
  /**
   * Specifies the port number that the bootstrap server listens on. Defaults to 8081.
   */
  port?: number | null
  /**
   * Specifies the maximum number of seconds that the bootstrap server will wait for upstream requests to complete. Defaults to 30.
   */
  timeout?: number | null

  [k: string]: unknown
}

export interface BuildProcessConfiguration {
  /**
   * Arguments for packtool.
   */
  args?: string | null
  /**
   * Main command to run the packtool.
   */
  packtool?: string | null

  [k: string]: unknown
}

export interface HTTPAdapterConfiguration {
  enabled?: EnableHTTPAdapter

  [k: string]: unknown
}

export interface LocalReplicaConfiguration {
  /**
   * Port the replica listens on.
   */
  port?: number | null
  subnet_type?: SubnetType

  [k: string]: unknown
}

export interface CustomNetworkConfiguration {
  /**
   * The URL(s) this network can be reached at.
   */
  providers: string[]
  /**
   * Persistence type of this network.
   */
  type?: NetworkType & string

  [k: string]: unknown
}

export interface LocalReplicaConfiguration1 {
  /**
   * Bind address for the webserver.
   */
  bind: string
  bitcoin?: BitcoinAdapterConfiguration | null
  bootstrap?: BootstrapServerConfiguration | null
  canister_http?: HTTPAdapterConfiguration | null
  replica?: LocalReplicaConfiguration | null
  /**
   * Persistence type of this network.
   */
  type?: NetworkType & string

  [k: string]: unknown
}
