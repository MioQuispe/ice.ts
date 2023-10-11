import type { Principal } from '@dfinity/principal';
export interface App {
  'logo' : string,
  'name' : string,
  'description' : string,
  'app_id' : string,
  'app_hash' : string,
  'category' : Category,
  'current_version' : Version,
  'price' : number,
}
export interface AppInfo {
  'app_id' : string,
  'current_version' : Version,
  'latest_version' : Version,
  'wallet_id' : [] | [Principal],
}
export interface AppInstallRequest { 'app_id' : string }
export interface Canister {
  'canister_id' : Principal,
  'canister_type' : CanisterType,
}
export type CanisterType = { 'BACKEND' : null } |
  { 'ASSET' : null };
export interface CashFlow {
  'balance' : bigint,
  'operator' : Principal,
  'created_at' : bigint,
  'comment' : string,
  'cycles' : bigint,
  'cash_flow_type' : CashFlowType,
}
export type CashFlowType = { 'CHARGE' : null } |
  { 'RECHARGE' : null };
export type Category = { 'System' : null } |
  { 'Vault' : null };
export interface CycleInfo {
  'records' : Array<CycleRecord>,
  'estimate_remaining' : bigint,
}
export interface CycleRecord { 'ts' : bigint, 'balance' : bigint }
export type GAError = { 'Error' : string };
export interface GAVerifyRequest { 'code' : string }
export type Result = { 'Ok' : Array<App> } |
  { 'Err' : WalletError };
export type Result_1 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_10 = { 'Ok' : Array<UserApp> } |
  { 'Err' : WalletError };
export type Result_11 = { 'Ok' : bigint } |
  { 'Err' : WalletError };
export type Result_12 = { 'Ok' : Array<CashFlow> } |
  { 'Err' : WalletError };
export type Result_2 = { 'Ok' : AppInfo } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : Array<CycleRecord> } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : CycleInfo } |
  { 'Err' : string };
export type Result_6 = { 'Ok' : boolean } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : Array<string> } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : string } |
  { 'Err' : GAError };
export type Result_9 = { 'Ok' : null } |
  { 'Err' : WalletError };
export interface UserApp {
  'app' : App,
  'canister' : Canister,
  'latest_version' : Version,
}
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface WalletError { 'msg' : string, 'code' : number }
export interface _SERVICE {
  'app_main_list' : () => Promise<Result>,
  'balance_get' : () => Promise<Result_1>,
  'ego_app_info_get' : () => Promise<Result_2>,
  'ego_app_info_update' : (
      arg_0: [] | [Principal],
      arg_1: string,
      arg_2: Version,
    ) => Promise<Result_3>,
  'ego_app_version_check' : () => Promise<Result_2>,
  'ego_canister_add' : (arg_0: string, arg_1: Principal) => Promise<Result_3>,
  'ego_canister_remove' : () => Promise<Result_3>,
  'ego_canister_upgrade' : () => Promise<Result_3>,
  'ego_controller_add' : (arg_0: Principal) => Promise<Result_3>,
  'ego_controller_remove' : (arg_0: Principal) => Promise<Result_3>,
  'ego_controller_set' : (arg_0: Array<Principal>) => Promise<Result_3>,
  'ego_cycle_check' : () => Promise<Result_3>,
  'ego_cycle_estimate_set' : (arg_0: bigint) => Promise<Result_3>,
  'ego_cycle_history' : () => Promise<Result_4>,
  'ego_cycle_info' : () => Promise<Result_5>,
  'ego_cycle_recharge' : (arg_0: bigint) => Promise<Result_3>,
  'ego_cycle_threshold_get' : () => Promise<Result_1>,
  'ego_is_owner' : () => Promise<Result_6>,
  'ego_is_user' : () => Promise<Result_6>,
  'ego_log_list' : (arg_0: bigint) => Promise<Result_7>,
  'ego_op_add' : (arg_0: Principal) => Promise<Result_3>,
  'ego_owner_add' : (arg_0: Principal) => Promise<Result_3>,
  'ego_owner_add_with_name' : (arg_0: string, arg_1: Principal) => Promise<
      Result_3
    >,
  'ego_owner_remove' : (arg_0: Principal) => Promise<Result_3>,
  'ego_owner_set' : (arg_0: Array<Principal>) => Promise<Result_3>,
  'ego_runtime_cycle_threshold_get' : () => Promise<Result_1>,
  'ego_user_add' : (arg_0: Principal) => Promise<Result_3>,
  'ego_user_remove' : (arg_0: Principal) => Promise<Result_3>,
  'ego_user_set' : (arg_0: Array<Principal>) => Promise<Result_3>,
  'ga_enabled' : () => Promise<boolean>,
  'ga_guard' : (arg_0: [] | [GAVerifyRequest]) => Promise<boolean>,
  'ga_reset' : () => Promise<Result_8>,
  'ga_secret' : () => Promise<[] | [string]>,
  'ga_set_enabled' : (arg_0: boolean, arg_1: [] | [Principal]) => Promise<
      undefined
    >,
  'ga_url' : () => Promise<string>,
  'ga_verify' : (arg_0: GAVerifyRequest) => Promise<boolean>,
  'install_app' : (arg_0: AppInstallRequest) => Promise<Result_9>,
  'remove_app' : (arg_0: Principal) => Promise<Result_9>,
  'upgrade_app' : (arg_0: Principal) => Promise<Result_9>,
  'wallet_app_list' : () => Promise<Result_10>,
  'wallet_cycle_balance' : () => Promise<Result_11>,
  'wallet_cycle_list' : () => Promise<Result_12>,
}
