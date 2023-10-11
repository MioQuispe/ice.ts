import type { Principal } from '@dfinity/principal';
export interface AccountBalanceArgs { 'account' : Array<number> }
export interface AccountDetail {
  'principal' : Principal,
  'active' : boolean,
  'sub_account' : Array<number>,
  'account_identifier' : string,
  'wallet_name' : string,
}
export interface AppInfo {
  'app_id' : string,
  'current_version' : Version,
  'latest_version' : Version,
  'wallet_id' : [] | [Principal],
}
export interface CallCanisterArgs {
  'args' : Array<number>,
  'cycles' : bigint,
  'method_name' : string,
  'canister' : Principal,
}
export interface CallResult { 'return' : Array<number> }
export interface CycleInfo {
  'records' : Array<CycleRecord>,
  'estimate_remaining' : bigint,
}
export interface CycleRecord { 'ts' : bigint, 'balance' : bigint }
export interface ECDSAPublicKeyPayload {
  'public_key_uncompressed' : Array<number>,
  'public_key' : Array<number>,
  'chain_code' : Array<number>,
}
export interface ExpiryUser {
  'user' : Principal,
  'expiry_timestamp' : bigint,
  'timestamp' : bigint,
}
export interface GAVerifyRequest { 'code' : string }
export interface ManagerPayload { 'principal' : Principal, 'name' : string }
export type Result = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : Array<Array<number>> } |
  { 'Err' : string };
export type Result_10 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_11 = { 'Ok' : CallResult } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : ECDSAPublicKeyPayload } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : SignatureReply } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : AppInfo } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_6 = { 'Ok' : Array<CycleRecord> } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : CycleInfo } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : boolean } |
  { 'Err' : string };
export type Result_9 = { 'Ok' : Array<string> } |
  { 'Err' : string };
export interface SendArgs {
  'account_id' : Array<number>,
  'memo' : [] | [bigint],
  'from_subaccount' : [] | [Array<number>],
  'amount' : Tokens,
}
export interface SignatureReply { 'signature' : Array<number> }
export interface Tokens { 'e8s' : bigint }
export interface TransferArgs {
  'memo' : [] | [bigint],
  'sub_account_to' : [] | [Array<number>],
  'from_subaccount' : [] | [Array<number>],
  'principal_to' : Principal,
  'amount' : Tokens,
}
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface _SERVICE {
  'addExpiryUser' : (arg_0: Principal, arg_1: [] | [bigint]) => Promise<
      ExpiryUser
    >,
  'addManager' : (arg_0: ManagerPayload) => Promise<undefined>,
  'balance_get' : () => Promise<Result>,
  'cycleBalance' : () => Promise<bigint>,
  'ecGetDeriveBytes' : (arg_0: string) => Promise<Result_1>,
  'ecGetPublicKey' : (arg_0: string, arg_1: [] | [string]) => Promise<Result_2>,
  'ecSign' : (
      arg_0: string,
      arg_1: Array<number>,
      arg_2: [] | [GAVerifyRequest],
    ) => Promise<Result_3>,
  'ecSignRecoverable' : (
      arg_0: string,
      arg_1: Array<number>,
      arg_2: [] | [number],
      arg_3: [] | [GAVerifyRequest],
    ) => Promise<Result_3>,
  'ego_app_info_get' : () => Promise<Result_4>,
  'ego_app_info_update' : (
      arg_0: [] | [Principal],
      arg_1: string,
      arg_2: Version,
    ) => Promise<Result_5>,
  'ego_app_version_check' : () => Promise<Result_4>,
  'ego_canister_add' : (arg_0: string, arg_1: Principal) => Promise<Result_5>,
  'ego_canister_remove' : () => Promise<Result_5>,
  'ego_canister_upgrade' : () => Promise<Result_5>,
  'ego_controller_add' : (arg_0: Principal) => Promise<Result_5>,
  'ego_controller_remove' : (arg_0: Principal) => Promise<Result_5>,
  'ego_controller_set' : (arg_0: Array<Principal>) => Promise<Result_5>,
  'ego_cycle_check' : () => Promise<Result_5>,
  'ego_cycle_estimate_set' : (arg_0: bigint) => Promise<Result_5>,
  'ego_cycle_history' : () => Promise<Result_6>,
  'ego_cycle_info' : () => Promise<Result_7>,
  'ego_cycle_recharge' : (arg_0: bigint) => Promise<Result_5>,
  'ego_cycle_threshold_get' : () => Promise<Result>,
  'ego_is_owner' : () => Promise<Result_8>,
  'ego_is_user' : () => Promise<Result_8>,
  'ego_log_list' : (arg_0: bigint) => Promise<Result_9>,
  'ego_op_add' : (arg_0: Principal) => Promise<Result_5>,
  'ego_owner_add' : (arg_0: Principal) => Promise<Result_5>,
  'ego_owner_add_with_name' : (arg_0: string, arg_1: Principal) => Promise<
      Result_5
    >,
  'ego_owner_remove' : (arg_0: Principal) => Promise<Result_5>,
  'ego_owner_set' : (arg_0: Array<Principal>) => Promise<Result_5>,
  'ego_runtime_cycle_threshold_get' : () => Promise<Result>,
  'ego_user_add' : (arg_0: Principal) => Promise<Result_5>,
  'ego_user_remove' : (arg_0: Principal) => Promise<Result_5>,
  'ego_user_set' : (arg_0: Array<Principal>) => Promise<Result_5>,
  'icpAddAccount' : (arg_0: AccountDetail) => Promise<undefined>,
  'icpGetAccounts' : () => Promise<Array<AccountDetail>>,
  'icpGetAddress' : (arg_0: [] | [Array<number>]) => Promise<string>,
  'icpGetBalance' : (arg_0: [] | [AccountBalanceArgs]) => Promise<Tokens>,
  'icpListSubaccount' : () => Promise<Array<string>>,
  'icpSend' : (arg_0: SendArgs, arg_1: [] | [GAVerifyRequest]) => Promise<
      Result_10
    >,
  'icpTransfer' : (
      arg_0: TransferArgs,
      arg_1: [] | [GAVerifyRequest],
    ) => Promise<Result_10>,
  'icpUpdateAccount' : (arg_0: AccountDetail) => Promise<boolean>,
  'isManager' : () => Promise<boolean>,
  'listManager' : () => Promise<Array<ManagerPayload>>,
  'proxyCall' : (arg_0: CallCanisterArgs) => Promise<Result_11>,
  'proxyCallWithGA' : (
      arg_0: CallCanisterArgs,
      arg_1: [] | [GAVerifyRequest],
    ) => Promise<Result_11>,
  'removeManager' : (arg_0: Principal) => Promise<undefined>,
  'setExpiryPeriod' : (arg_0: bigint) => Promise<undefined>,
  'setLocalGA' : (arg_0: boolean) => Promise<boolean>,
}
