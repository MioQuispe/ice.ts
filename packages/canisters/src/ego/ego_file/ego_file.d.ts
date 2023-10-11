import type { Principal } from '@dfinity/principal';
export interface CycleInfo {
  'records' : Array<CycleRecord>,
  'estimate_remaining' : bigint,
}
export interface CycleRecord { 'ts' : bigint, 'balance' : bigint }
export interface EgoError { 'msg' : string, 'code' : number }
export interface InitArg { 'init_caller' : [] | [Principal] }
export type Result = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : Array<CycleRecord> } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : CycleInfo } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : Array<string> } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : Array<number> } |
  { 'Err' : EgoError };
export type Result_6 = { 'Ok' : boolean } |
  { 'Err' : EgoError };
export interface _SERVICE {
  'balance_get' : () => Promise<Result>,
  'ego_canister_add' : (arg_0: string, arg_1: Principal) => Promise<Result_1>,
  'ego_controller_add' : (arg_0: Principal) => Promise<Result_1>,
  'ego_controller_remove' : (arg_0: Principal) => Promise<Result_1>,
  'ego_controller_set' : (arg_0: Array<Principal>) => Promise<Result_1>,
  'ego_cycle_check' : () => Promise<Result_1>,
  'ego_cycle_estimate_set' : (arg_0: bigint) => Promise<Result_1>,
  'ego_cycle_history' : () => Promise<Result_2>,
  'ego_cycle_info' : () => Promise<Result_3>,
  'ego_cycle_recharge' : (arg_0: bigint) => Promise<Result_1>,
  'ego_cycle_threshold_get' : () => Promise<Result>,
  'ego_log_list' : (arg_0: bigint) => Promise<Result_4>,
  'ego_op_add' : (arg_0: Principal) => Promise<Result_1>,
  'ego_owner_add' : (arg_0: Principal) => Promise<Result_1>,
  'ego_owner_remove' : (arg_0: Principal) => Promise<Result_1>,
  'ego_owner_set' : (arg_0: Array<Principal>) => Promise<Result_1>,
  'ego_user_add' : (arg_0: Principal) => Promise<Result_1>,
  'ego_user_remove' : (arg_0: Principal) => Promise<Result_1>,
  'ego_user_set' : (arg_0: Array<Principal>) => Promise<Result_1>,
  'file_main_read' : (arg_0: string) => Promise<Result_5>,
  'file_main_write' : (
      arg_0: string,
      arg_1: string,
      arg_2: Array<number>,
    ) => Promise<Result_6>,
  'state_persist' : () => Promise<Result_6>,
  'state_restore' : () => Promise<Result_6>,
}
