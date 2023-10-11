import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface App {
  logo: string;
  name: string;
  description: string;
  app_id: string;
  category: Category;
  current_version: Version;
  price: number;
}
export interface AppInfo {
  app_id: string;
  current_version: Version;
  latest_version: Version;
  wallet_id: [] | [Principal];
}
export interface AppInstallRequest {
  app_id: string;
}
export interface Canister {
  canister_id: Principal;
  canister_type: CanisterType;
}
export type CanisterType = { BACKEND: null } | { ASSET: null };
export type Category = { System: null } | { Vault: null };
export type GAError = { Error: string };
export interface GAVerifyRequest {
  code: string;
}
export type Result = { Ok: AppInfo } | { Err: string };
export type Result_1 = { Ok: null } | { Err: string };
export type Result_2 = { Ok: Array<App> } | { Err: WalletError };
export type Result_3 = { Ok: bigint } | { Err: string };
export type Result_4 = { Ok: Array<string> } | { Err: string };
export type Result_5 = { Ok: string } | { Err: GAError };
export type Result_6 = { Ok: null } | { Err: WalletError };
export type Result_7 = { Ok: Array<UserApp> } | { Err: WalletError };
export interface UserApp {
  app: App;
  canister: Canister;
  latest_version: Version;
}
export interface Version {
  major: number;
  minor: number;
  patch: number;
}
export interface WalletError {
  msg: string;
  code: number;
}
export interface _SERVICE {
  app_info_get: ActorMethod<[], Result>;
  app_info_update: ActorMethod<[Principal, string, Version], Result_1>;
  app_main_list: ActorMethod<[], Result_2>;
  app_version_check: ActorMethod<[], Result>;
  balance_get: ActorMethod<[], Result_3>;
  ego_canister_add: ActorMethod<[string, Principal], Result_1>;
  ego_canister_upgrade: ActorMethod<[], Result_1>;
  ego_controller_add: ActorMethod<[Principal], Result_1>;
  ego_controller_remove: ActorMethod<[Principal], Result_1>;
  ego_controller_set: ActorMethod<[Array<Principal>], Result_1>;
  ego_log_list: ActorMethod<[bigint], Result_4>;
  ego_op_add: ActorMethod<[Principal], Result_1>;
  ego_owner_add: ActorMethod<[Principal], Result_1>;
  ego_owner_remove: ActorMethod<[Principal], Result_1>;
  ego_owner_set: ActorMethod<[Array<Principal>], Result_1>;
  ego_user_add: ActorMethod<[Principal], Result_1>;
  ego_user_remove: ActorMethod<[Principal], Result_1>;
  ego_user_set: ActorMethod<[Array<Principal>], Result_1>;
  ga_enabled: ActorMethod<[], boolean>;
  ga_guard: ActorMethod<[[] | [GAVerifyRequest]], boolean>;
  ga_reset: ActorMethod<[], Result_5>;
  ga_secret: ActorMethod<[], [] | [string]>;
  ga_set_enabled: ActorMethod<[boolean, [] | [Principal]], undefined>;
  ga_url: ActorMethod<[], string>;
  ga_verify: ActorMethod<[GAVerifyRequest], boolean>;
  install_app: ActorMethod<[AppInstallRequest], Result_6>;
  uninstall_app: ActorMethod<[Principal], Result_6>;
  upgrade_app: ActorMethod<[Principal], Result_6>;
  wallet_app_list: ActorMethod<[], Result_7>;
}
