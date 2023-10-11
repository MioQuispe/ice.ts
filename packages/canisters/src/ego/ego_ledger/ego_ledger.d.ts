import type { Principal } from '@dfinity/principal';
export interface CycleInfo {
  'records' : Array<CycleRecord>,
  'estimate_remaining' : bigint,
}
export interface CycleRecord { 'ts' : bigint, 'balance' : bigint }
export interface EgoError { 'msg' : string, 'code' : number }
export interface InitArg { 'init_caller' : [] | [Principal] }
export interface LedgerMainInitRequest { 'start' : bigint }
export interface LedgerPaymentAddRequest {
  'to' : Array<number>,
  'from' : Array<number>,
  'memo' : bigint,
  'amount' : Tokens,
}
export interface Payment {
  'to' : Array<number>,
  'status' : PaymentStatus,
  'from' : Array<number>,
  'memo' : bigint,
  'amount' : Tokens,
}
export type PaymentStatus = { 'NOTIFIED' : null } |
  { 'PENDING' : null } |
  { 'CONFIRMED' : null };
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
export type Result_5 = { 'Ok' : null } |
  { 'Err' : EgoError };
export type Result_6 = { 'Ok' : Array<Payment> } |
  { 'Err' : EgoError };
export interface Tokens { 'e8s' : bigint }
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
  'ledger_main_init' : (arg_0: LedgerMainInitRequest) => Promise<Result_5>,
  'ledger_payment_add' : (arg_0: LedgerPaymentAddRequest) => Promise<Result_5>,
  'ledger_payment_list' : () => Promise<Result_6>,
  'message_main_notify' : () => Promise<undefined>,
}
