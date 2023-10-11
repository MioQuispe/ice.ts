import type { Principal } from '@dfinity/principal';
export interface AppMainInstallRequest {
  'wasm' : Wasm,
  'user_id' : Principal,
  'wallet_id' : Principal,
}
export interface AppMainUpgradeRequest {
  'canister_id' : Principal,
  'wasm' : Wasm,
}
export type CanisterType = { 'BACKEND' : null } |
  { 'ASSET' : null };
export interface CycleRecord { 'ts' : bigint, 'balance' : bigint }
export interface EgoError { 'msg' : string, 'code' : number }
export interface InitArg { 'init_caller' : [] | [Principal] }
export type Result = { 'Ok' : null } |
  { 'Err' : EgoError };
export type Result_1 = { 'Ok' : Principal } |
  { 'Err' : EgoError };
export type Result_2 = { 'Ok' : boolean } |
  { 'Err' : EgoError };
export type Result_3 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : Array<string> } |
  { 'Err' : string };
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface Wasm {
  'canister_id' : Principal,
  'version' : Version,
  'app_id' : string,
  'canister_type' : CanisterType,
}
export interface _SERVICE {
  'app_main_delete' : (arg_0: Principal) => Promise<Result>,
  'app_main_install' : (arg_0: AppMainInstallRequest) => Promise<Result_1>,
  'app_main_upgrade' : (arg_0: AppMainUpgradeRequest) => Promise<Result_2>,
  'canister_main_track' : (arg_0: Principal, arg_1: Principal) => Promise<
      Result
    >,
  'canister_main_untrack' : (arg_0: Principal) => Promise<Result>,
  'ego_canister_add' : (arg_0: string, arg_1: Principal) => Promise<Result_3>,
  'ego_controller_add' : (arg_0: Principal) => Promise<Result_3>,
  'ego_controller_remove' : (arg_0: Principal) => Promise<Result_3>,
  'ego_controller_set' : (arg_0: Array<Principal>) => Promise<Result_3>,
  'ego_cycle_check_cb' : (arg_0: Array<CycleRecord>, arg_1: bigint) => Promise<
      Result
    >,
  'ego_log_list' : (arg_0: bigint) => Promise<Result_4>,
  'ego_op_add' : (arg_0: Principal) => Promise<Result_3>,
  'ego_owner_add' : (arg_0: Principal) => Promise<Result_3>,
  'ego_owner_remove' : (arg_0: Principal) => Promise<Result_3>,
  'ego_owner_set' : (arg_0: Array<Principal>) => Promise<Result_3>,
  'ego_user_add' : (arg_0: Principal) => Promise<Result_3>,
  'ego_user_remove' : (arg_0: Principal) => Promise<Result_3>,
  'ego_user_set' : (arg_0: Array<Principal>) => Promise<Result_3>,
  'wallet_cycle_recharge' : (arg_0: bigint) => Promise<Result>,
}
