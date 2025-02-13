import type { Principal } from '@dfinity/principal';
export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Array<number>],
}
export interface Allowance {
  'allowance' : bigint,
  'expires_at' : [] | [bigint],
}
export interface AllowanceArgs { 'account' : Account, 'spender' : Account }
export interface ApproveArgs {
  'fee' : [] | [bigint],
  'memo' : [] | [Array<number>],
  'from_subaccount' : [] | [Array<number>],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'expected_allowance' : [] | [bigint],
  'expires_at' : [] | [bigint],
  'spender' : Account,
}
export type ApproveError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'AllowanceChanged' : { 'current_allowance' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'Expired' : { 'ledger_time' : bigint } } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export type BlockIndex = bigint;
export interface CanisterSettings {
  'freezing_threshold' : [] | [bigint],
  'controllers' : [] | [Array<Principal>],
  'reserved_cycles_limit' : [] | [bigint],
  'memory_allocation' : [] | [bigint],
  'compute_allocation' : [] | [bigint],
}
export type ChangeIndexId = { 'SetTo' : Principal } |
  { 'Unset' : null };
export interface CmcCreateCanisterArgs {
  'subnet_selection' : [] | [SubnetSelection],
  'settings' : [] | [CanisterSettings],
}
export interface CreateCanisterArgs {
  'from_subaccount' : [] | [Array<number>],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'creation_args' : [] | [CmcCreateCanisterArgs],
}
export type CreateCanisterError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  {
    'Duplicate' : { 'duplicate_of' : bigint, 'canister_id' : [] | [Principal] }
  } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  {
    'FailedToCreate' : {
      'error' : string,
      'refund_block' : [] | [BlockIndex],
      'fee_block' : [] | [BlockIndex],
    }
  } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export interface CreateCanisterFromArgs {
  'spender_subaccount' : [] | [Array<number>],
  'from' : Account,
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'creation_args' : [] | [CmcCreateCanisterArgs],
}
export type CreateCanisterFromError = {
    'FailedToCreateFrom' : {
      'create_from_block' : [] | [BlockIndex],
      'rejection_code' : RejectionCode,
      'refund_block' : [] | [BlockIndex],
      'approval_refund_block' : [] | [BlockIndex],
      'rejection_reason' : string,
    }
  } |
  { 'GenericError' : { 'message' : string, 'error_code' : bigint } } |
  { 'TemporarilyUnavailable' : null } |
  { 'InsufficientAllowance' : { 'allowance' : bigint } } |
  {
    'Duplicate' : { 'duplicate_of' : bigint, 'canister_id' : [] | [Principal] }
  } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export interface CreateCanisterSuccess {
  'block_id' : BlockIndex,
  'canister_id' : Principal,
}
export interface DataCertificate {
  'certificate' : Array<number>,
  'hash_tree' : Array<number>,
}
export interface DepositArgs { 'to' : Account, 'memo' : [] | [Array<number>] }
export interface DepositResult {
  'balance' : bigint,
  'block_index' : BlockIndex,
}
export interface GetArchivesArgs { 'from' : [] | [Principal] }
export type GetArchivesResult = Array<
  { 'end' : bigint, 'canister_id' : Principal, 'start' : bigint }
>;
export type GetBlocksArgs = Array<{ 'start' : bigint, 'length' : bigint }>;
export interface GetBlocksResult {
  'log_length' : bigint,
  'blocks' : Array<{ 'id' : bigint, 'block' : Value }>,
  'archived_blocks' : Array<
    { 'args' : GetBlocksArgs, 'callback' : [Principal, string] }
  >,
}
export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : Array<number>,
  'headers' : Array<[string, string]>,
}
export interface HttpResponse {
  'body' : Array<number>,
  'headers' : Array<[string, string]>,
  'status_code' : number,
}
export interface InitArgs {
  'index_id' : [] | [Principal],
  'max_blocks_per_request' : bigint,
}
export type LedgerArgs = { 'Upgrade' : [] | [UpgradeArgs] } |
  { 'Init' : InitArgs };
export type MetadataValue = { 'Int' : bigint } |
  { 'Nat' : bigint } |
  { 'Blob' : Array<number> } |
  { 'Text' : string };
export type RejectionCode = { 'NoError' : null } |
  { 'CanisterError' : null } |
  { 'SysTransient' : null } |
  { 'DestinationInvalid' : null } |
  { 'Unknown' : null } |
  { 'SysFatal' : null } |
  { 'CanisterReject' : null };
export interface SubnetFilter { 'subnet_type' : [] | [string] }
export type SubnetSelection = { 'Filter' : SubnetFilter } |
  { 'Subnet' : { 'subnet' : Principal } };
export interface SupportedBlockType { 'url' : string, 'block_type' : string }
export interface SupportedStandard { 'url' : string, 'name' : string }
export interface TransferArgs {
  'to' : Account,
  'fee' : [] | [bigint],
  'memo' : [] | [Array<number>],
  'from_subaccount' : [] | [Array<number>],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
}
export type TransferError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'BadBurn' : { 'min_burn_amount' : bigint } } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export interface TransferFromArgs {
  'to' : Account,
  'fee' : [] | [bigint],
  'spender_subaccount' : [] | [Array<number>],
  'from' : Account,
  'memo' : [] | [Array<number>],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
}
export type TransferFromError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'InsufficientAllowance' : { 'allowance' : bigint } } |
  { 'BadBurn' : { 'min_burn_amount' : bigint } } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export interface UpgradeArgs {
  'change_index_id' : [] | [ChangeIndexId],
  'max_blocks_per_request' : [] | [bigint],
}
export type Value = { 'Int' : bigint } |
  { 'Map' : Array<[string, Value]> } |
  { 'Nat' : bigint } |
  { 'Nat64' : bigint } |
  { 'Blob' : Array<number> } |
  { 'Text' : string } |
  { 'Array' : Array<Value> };
export interface WithdrawArgs {
  'to' : Principal,
  'from_subaccount' : [] | [Array<number>],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
}
export type WithdrawError = {
    'FailedToWithdraw' : {
      'rejection_code' : RejectionCode,
      'fee_block' : [] | [bigint],
      'rejection_reason' : string,
    }
  } |
  { 'GenericError' : { 'message' : string, 'error_code' : bigint } } |
  { 'TemporarilyUnavailable' : null } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'InvalidReceiver' : { 'receiver' : Principal } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export interface WithdrawFromArgs {
  'to' : Principal,
  'spender_subaccount' : [] | [Array<number>],
  'from' : Account,
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
}
export type WithdrawFromError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'InsufficientAllowance' : { 'allowance' : bigint } } |
  { 'Duplicate' : { 'duplicate_of' : BlockIndex } } |
  { 'InvalidReceiver' : { 'receiver' : Principal } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  {
    'FailedToWithdrawFrom' : {
      'withdraw_from_block' : [] | [bigint],
      'rejection_code' : RejectionCode,
      'refund_block' : [] | [bigint],
      'approval_refund_block' : [] | [bigint],
      'rejection_reason' : string,
    }
  } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export interface _SERVICE {
  'create_canister' : (arg_0: CreateCanisterArgs) => Promise<
      { 'Ok' : CreateCanisterSuccess } |
        { 'Err' : CreateCanisterError }
    >,
  'create_canister_from' : (arg_0: CreateCanisterFromArgs) => Promise<
      { 'Ok' : CreateCanisterSuccess } |
        { 'Err' : CreateCanisterFromError }
    >,
  'deposit' : (arg_0: DepositArgs) => Promise<DepositResult>,
  'http_request' : (arg_0: HttpRequest) => Promise<HttpResponse>,
  'icrc1_balance_of' : (arg_0: Account) => Promise<bigint>,
  'icrc1_decimals' : () => Promise<number>,
  'icrc1_fee' : () => Promise<bigint>,
  'icrc1_metadata' : () => Promise<Array<[string, MetadataValue]>>,
  'icrc1_minting_account' : () => Promise<[] | [Account]>,
  'icrc1_name' : () => Promise<string>,
  'icrc1_supported_standards' : () => Promise<Array<SupportedStandard>>,
  'icrc1_symbol' : () => Promise<string>,
  'icrc1_total_supply' : () => Promise<bigint>,
  'icrc1_transfer' : (arg_0: TransferArgs) => Promise<
      { 'Ok' : BlockIndex } |
        { 'Err' : TransferError }
    >,
  'icrc2_allowance' : (arg_0: AllowanceArgs) => Promise<Allowance>,
  'icrc2_approve' : (arg_0: ApproveArgs) => Promise<
      { 'Ok' : bigint } |
        { 'Err' : ApproveError }
    >,
  'icrc2_transfer_from' : (arg_0: TransferFromArgs) => Promise<
      { 'Ok' : bigint } |
        { 'Err' : TransferFromError }
    >,
  'icrc3_get_archives' : (arg_0: GetArchivesArgs) => Promise<GetArchivesResult>,
  'icrc3_get_blocks' : (arg_0: GetBlocksArgs) => Promise<GetBlocksResult>,
  'icrc3_get_tip_certificate' : () => Promise<[] | [DataCertificate]>,
  'icrc3_supported_block_types' : () => Promise<Array<SupportedBlockType>>,
  'withdraw' : (arg_0: WithdrawArgs) => Promise<
      { 'Ok' : BlockIndex } |
        { 'Err' : WithdrawError }
    >,
  'withdraw_from' : (arg_0: WithdrawFromArgs) => Promise<
      { 'Ok' : BlockIndex } |
        { 'Err' : WithdrawFromError }
    >,
}
