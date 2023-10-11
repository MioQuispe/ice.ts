import type { Principal } from '@dfinity/principal';
export interface AdminWalletCycleRechargeRequest {
  'cycle' : bigint,
  'comment' : string,
  'wallet_id' : Principal,
}
export interface AdminWalletProviderAddRequest {
  'wallet_provider' : Principal,
  'wallet_app_id' : string,
}
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
export interface EgoError { 'msg' : string, 'code' : number }
export interface EgoStoreApp { 'app' : App, 'wasm' : Wasm }
export interface InitArg { 'init_caller' : [] | [Principal] }
export interface Order {
  'to' : Array<number>,
  'status' : OrderStatus,
  'from' : Array<number>,
  'memo' : bigint,
  'amount' : number,
  'wallet_id' : Principal,
}
export type OrderStatus = { 'NEW' : null } |
  { 'SUCCESS' : null };
export type Result = { 'Ok' : boolean } |
  { 'Err' : EgoError };
export type Result_1 = { 'Ok' : Array<Order> } |
  { 'Err' : EgoError };
export type Result_10 = { 'Ok' : UserApp } |
  { 'Err' : EgoError };
export type Result_11 = { 'Ok' : Array<UserApp> } |
  { 'Err' : EgoError };
export type Result_12 = { 'Ok' : bigint } |
  { 'Err' : EgoError };
export type Result_13 = { 'Ok' : WalletCycleChargeResponse } |
  { 'Err' : EgoError };
export type Result_14 = { 'Ok' : Array<CashFlow> } |
  { 'Err' : EgoError };
export type Result_15 = { 'Ok' : Principal } |
  { 'Err' : EgoError };
export type Result_16 = { 'Ok' : bigint } |
  { 'Err' : EgoError };
export type Result_2 = { 'Ok' : null } |
  { 'Err' : EgoError };
export type Result_3 = { 'Ok' : App } |
  { 'Err' : EgoError };
export type Result_4 = { 'Ok' : Array<App> } |
  { 'Err' : EgoError };
export type Result_5 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_6 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : Array<CycleRecord> } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : CycleInfo } |
  { 'Err' : string };
export type Result_9 = { 'Ok' : Array<string> } |
  { 'Err' : string };
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
export interface WalletCycleChargeRequest {
  'cycle' : bigint,
  'comment' : string,
  'wallet_id' : Principal,
}
export interface WalletCycleChargeResponse { 'ret' : boolean }
export interface Wasm {
  'canister_id' : Principal,
  'version' : Version,
  'app_id' : string,
  'canister_type' : CanisterType,
}
export interface _SERVICE {
  'admin_wallet_cycle_recharge' : (
      arg_0: AdminWalletCycleRechargeRequest,
    ) => Promise<Result>,
  'admin_wallet_order_list' : () => Promise<Result_1>,
  'admin_wallet_provider_add' : (
      arg_0: AdminWalletProviderAddRequest,
    ) => Promise<Result_2>,
  'app_main_get' : (arg_0: string) => Promise<Result_3>,
  'app_main_list' : () => Promise<Result_4>,
  'app_main_release' : (arg_0: EgoStoreApp) => Promise<Result>,
  'balance_get' : () => Promise<Result_5>,
  'ego_canister_add' : (arg_0: string, arg_1: Principal) => Promise<Result_6>,
  'ego_controller_add' : (arg_0: Principal) => Promise<Result_6>,
  'ego_controller_remove' : (arg_0: Principal) => Promise<Result_6>,
  'ego_controller_set' : (arg_0: Array<Principal>) => Promise<Result_6>,
  'ego_cycle_check' : () => Promise<Result_6>,
  'ego_cycle_estimate_set' : (arg_0: bigint) => Promise<Result_6>,
  'ego_cycle_history' : () => Promise<Result_7>,
  'ego_cycle_info' : () => Promise<Result_8>,
  'ego_cycle_recharge' : (arg_0: bigint) => Promise<Result_6>,
  'ego_cycle_threshold_get' : () => Promise<Result_5>,
  'ego_log_list' : (arg_0: bigint) => Promise<Result_9>,
  'ego_op_add' : (arg_0: Principal) => Promise<Result_6>,
  'ego_owner_add' : (arg_0: Principal) => Promise<Result_6>,
  'ego_owner_remove' : (arg_0: Principal) => Promise<Result_6>,
  'ego_owner_set' : (arg_0: Array<Principal>) => Promise<Result_6>,
  'ego_user_add' : (arg_0: Principal) => Promise<Result_6>,
  'ego_user_remove' : (arg_0: Principal) => Promise<Result_6>,
  'ego_user_set' : (arg_0: Array<Principal>) => Promise<Result_6>,
  'wallet_app_install' : (arg_0: string) => Promise<Result_10>,
  'wallet_app_list' : () => Promise<Result_11>,
  'wallet_app_remove' : (arg_0: Principal) => Promise<Result_2>,
  'wallet_app_upgrade' : (arg_0: Principal) => Promise<Result_2>,
  'wallet_canister_track' : (arg_0: Principal) => Promise<Result_2>,
  'wallet_canister_untrack' : (arg_0: Principal) => Promise<Result_2>,
  'wallet_cycle_balance' : () => Promise<Result_12>,
  'wallet_cycle_charge' : (arg_0: WalletCycleChargeRequest) => Promise<
      Result_13
    >,
  'wallet_cycle_list' : () => Promise<Result_14>,
  'wallet_main_new' : (arg_0: Principal) => Promise<Result_10>,
  'wallet_main_register' : (arg_0: Principal) => Promise<Result_15>,
  'wallet_order_list' : () => Promise<Result_1>,
  'wallet_order_new' : (arg_0: number) => Promise<Result_16>,
  'wallet_order_notify' : (arg_0: bigint) => Promise<Result>,
  'wallet_tenant_get' : () => Promise<Result_15>,
}
