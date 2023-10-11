import type { Principal } from '@dfinity/principal';
export interface AccountIdentifier { 'bytes' : Array<number> }
export type BlockIndex = bigint;
export type Cycles = bigint;
export interface CyclesCanisterInitPayload {
  'exchange_rate_canister' : [] | [ExchangeRateCanister],
  'last_purged_notification' : [] | [bigint],
  'governance_canister_id' : [] | [Principal],
  'minting_account_id' : [] | [AccountIdentifier],
  'ledger_canister_id' : [] | [Principal],
}
export type ExchangeRateCanister = { 'Set' : Principal } |
  { 'Unset' : null };
export interface IcpXdrConversionRate {
  'xdr_permyriad_per_icp' : bigint,
  'timestamp_seconds' : bigint,
}
export interface IcpXdrConversionRateResponse {
  'certificate' : Array<number>,
  'data' : IcpXdrConversionRate,
  'hash_tree' : Array<number>,
}
export interface NotifyCreateCanisterArg {
  'controller' : Principal,
  'block_index' : BlockIndex,
  'subnet_type' : [] | [string],
}
export type NotifyCreateCanisterResult = { 'Ok' : Principal } |
  { 'Err' : NotifyError };
export type NotifyError = {
    'Refunded' : { 'block_index' : [] | [BlockIndex], 'reason' : string }
  } |
  { 'InvalidTransaction' : string } |
  { 'Other' : { 'error_message' : string, 'error_code' : bigint } } |
  { 'Processing' : null } |
  { 'TransactionTooOld' : BlockIndex };
export interface NotifyTopUpArg {
  'block_index' : BlockIndex,
  'canister_id' : Principal,
}
export type NotifyTopUpResult = { 'Ok' : Cycles } |
  { 'Err' : NotifyError };
export interface PrincipalsAuthorizedToCreateCanistersToSubnetsResponse {
  'data' : Array<[Principal, Array<Principal>]>,
}
export interface SubnetTypesToSubnetsResponse {
  'data' : Array<[string, Array<Principal>]>,
}
export interface _SERVICE {
  'get_icp_xdr_conversion_rate' : () => Promise<IcpXdrConversionRateResponse>,
  'get_principals_authorized_to_create_canisters_to_subnets' : () => Promise<
      PrincipalsAuthorizedToCreateCanistersToSubnetsResponse
    >,
  'get_subnet_types_to_subnets' : () => Promise<SubnetTypesToSubnetsResponse>,
  'notify_create_canister' : (arg_0: NotifyCreateCanisterArg) => Promise<
      NotifyCreateCanisterResult
    >,
  'notify_top_up' : (arg_0: NotifyTopUpArg) => Promise<NotifyTopUpResult>,
}
