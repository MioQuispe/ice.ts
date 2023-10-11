import type { Principal } from '@dfinity/principal';
export interface AdminAppCreateRequest {
  'logo' : string,
  'name' : string,
  'description' : string,
  'version' : Version,
  'app_id' : string,
  'category' : Category,
  'backend_data_hash' : string,
  'backend_data' : Array<number>,
}
export interface AdminWalletCycleRechargeRequest {
  'cycle' : bigint,
  'comment' : string,
  'wallet_id' : Principal,
}
export interface AdminWalletProviderAddRequest {
  'wallet_provider' : Principal,
  'wallet_app_id' : string,
}
export type Category = { 'System' : null } |
  { 'Vault' : null };
export interface CycleInfo {
  'records' : Array<CycleRecord>,
  'estimate_remaining' : bigint,
}
export interface CycleRecord { 'ts' : bigint, 'balance' : bigint }
export interface EgoError { 'msg' : string, 'code' : number }
export interface InitArg { 'init_caller' : [] | [Principal] }
export type Result = { 'Ok' : null } |
  { 'Err' : EgoError };
export type Result_1 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : Array<CycleRecord> } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : CycleInfo } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : Array<string> } |
  { 'Err' : string };
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface _SERVICE {
  'admin_app_create' : (arg_0: AdminAppCreateRequest) => Promise<Result>,
  'admin_wallet_cycle_recharge' : (
      arg_0: AdminWalletCycleRechargeRequest,
    ) => Promise<Result>,
  'admin_wallet_order_new' : (arg_0: number) => Promise<Result>,
  'admin_wallet_provider_add' : (
      arg_0: AdminWalletProviderAddRequest,
    ) => Promise<Result>,
  'balance_get' : () => Promise<Result_1>,
  'canister_main_track' : () => Promise<undefined>,
  'canister_relation_update' : (arg_0: string) => Promise<undefined>,
  'ego_canister_add' : (arg_0: string, arg_1: Principal) => Promise<Result_2>,
  'ego_controller_add' : (arg_0: Principal) => Promise<Result_2>,
  'ego_controller_remove' : (arg_0: Principal) => Promise<Result_2>,
  'ego_controller_set' : (arg_0: Array<Principal>) => Promise<Result_2>,
  'ego_cycle_check' : () => Promise<Result_2>,
  'ego_cycle_estimate_set' : (arg_0: bigint) => Promise<Result_2>,
  'ego_cycle_history' : () => Promise<Result_3>,
  'ego_cycle_info' : () => Promise<Result_4>,
  'ego_cycle_recharge' : (arg_0: bigint) => Promise<Result_2>,
  'ego_cycle_threshold_get' : () => Promise<Result_1>,
  'ego_log_list' : (arg_0: bigint) => Promise<Result_5>,
  'ego_op_add' : (arg_0: Principal) => Promise<Result_2>,
  'ego_owner_add' : (arg_0: Principal) => Promise<Result_2>,
  'ego_owner_remove' : (arg_0: Principal) => Promise<Result_2>,
  'ego_owner_set' : (arg_0: Array<Principal>) => Promise<Result_2>,
  'ego_user_add' : (arg_0: Principal) => Promise<Result_2>,
  'ego_user_remove' : (arg_0: Principal) => Promise<Result_2>,
  'ego_user_set' : (arg_0: Array<Principal>) => Promise<Result_2>,
}
