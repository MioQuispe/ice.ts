import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface AccountBalanceArgs {
  account: Array<number>;
}
export interface AccountDetail {
  principal: Principal;
  active: boolean;
  sub_account: Array<number>;
  account_identifier: string;
  wallet_name: string;
}
export interface AppInfo {
  app_id: string;
  current_version: Version;
  latest_version: Version;
  wallet_id: [] | [Principal];
}
export interface CallCanisterArgs {
  args: Array<number>;
  cycles: bigint;
  method_name: string;
  canister: Principal;
}
export interface CallResult {
  return: Array<number>;
}
export interface ECDSAPublicKeyPayload {
  public_key_uncompressed: Array<number>;
  public_key: Array<number>;
  chain_code: Array<number>;
}
export interface ExpiryUser {
  user: Principal;
  expiry_timestamp: bigint;
  timestamp: bigint;
}
export interface GAVerifyRequest {
  code: string;
}
export interface ManagerPayload {
  principal: Principal;
  name: string;
}
export type Result = { Ok: AppInfo } | { Err: string };
export type Result_1 = { Ok: null } | { Err: string };
export type Result_2 = { Ok: bigint } | { Err: string };
export type Result_3 = { Ok: Array<Array<number>> } | { Err: string };
export type Result_4 = { Ok: ECDSAPublicKeyPayload } | { Err: string };
export type Result_5 = { Ok: SignatureReply } | { Err: string };
export type Result_6 = { Ok: Array<string> } | { Err: string };
export type Result_7 = { Ok: bigint } | { Err: string };
export type Result_8 = { Ok: CallResult } | { Err: string };
export interface SendArgs {
  account_id: Array<number>;
  memo: [] | [bigint];
  from_subaccount: [] | [Array<number>];
  amount: Tokens;
}
export interface SignatureReply {
  signature: Array<number>;
}
export interface Tokens {
  e8s: bigint;
}
export interface TransferArgs {
  memo: [] | [bigint];
  sub_account_to: [] | [Array<number>];
  from_subaccount: [] | [Array<number>];
  principal_to: Principal;
  amount: Tokens;
}
export interface Version {
  major: number;
  minor: number;
  patch: number;
}
export interface _SERVICE {
  addExpiryUser: ActorMethod<[Principal], ExpiryUser>;
  addManager: ActorMethod<[ManagerPayload], undefined>;
  app_info_get: ActorMethod<[], Result>;
  app_info_update: ActorMethod<[Principal, string, Version], Result_1>;
  app_version_check: ActorMethod<[], Result>;
  balance_get: ActorMethod<[], Result_2>;
  cycleBalance: ActorMethod<[], bigint>;
  ecGetDeriveBytes: ActorMethod<[string], Result_3>;
  ecGetPublicKey: ActorMethod<[string, [] | [string]], Result_4>;
  ecSign: ActorMethod<[string, Array<number>, [] | [GAVerifyRequest]], Result_5>;
  ecSignRecoverable: ActorMethod<[string, Array<number>, [] | [number], [] | [GAVerifyRequest]], Result_5>;
  ego_canister_add: ActorMethod<[string, Principal], Result_1>;
  ego_canister_upgrade: ActorMethod<[], Result_1>;
  ego_controller_add: ActorMethod<[Principal], Result_1>;
  ego_controller_remove: ActorMethod<[Principal], Result_1>;
  ego_controller_set: ActorMethod<[Array<Principal>], Result_1>;
  ego_log_list: ActorMethod<[bigint], Result_6>;
  ego_op_add: ActorMethod<[Principal], Result_1>;
  ego_owner_add: ActorMethod<[Principal], Result_1>;
  ego_owner_remove: ActorMethod<[Principal], Result_1>;
  ego_owner_set: ActorMethod<[Array<Principal>], Result_1>;
  ego_user_add: ActorMethod<[Principal], Result_1>;
  ego_user_remove: ActorMethod<[Principal], Result_1>;
  ego_user_set: ActorMethod<[Array<Principal>], Result_1>;
  icpAddAccount: ActorMethod<[AccountDetail], undefined>;
  icpGetAccounts: ActorMethod<[], Array<AccountDetail>>;
  icpGetAddress: ActorMethod<[[] | [Array<number>]], string>;
  icpGetBalance: ActorMethod<[[] | [AccountBalanceArgs]], Tokens>;
  icpListSubaccount: ActorMethod<[], Array<string>>;
  icpSend: ActorMethod<[SendArgs, [] | [GAVerifyRequest]], Result_7>;
  icpTransfer: ActorMethod<[TransferArgs, [] | [GAVerifyRequest]], Result_7>;
  icpUpdateAccount: ActorMethod<[AccountDetail], boolean>;
  isManager: ActorMethod<[], boolean>;
  listManager: ActorMethod<[], Array<ManagerPayload>>;
  proxyCall: ActorMethod<[CallCanisterArgs], Result_8>;
  removeManager: ActorMethod<[Principal], undefined>;
  setExpiryPeriod: ActorMethod<[bigint], undefined>;
  setLocalGA: ActorMethod<[boolean], boolean>;
}
