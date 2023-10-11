import type { Principal } from '@dfinity/principal';
export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Subaccount],
}
export interface Allowance {
  'allowance' : bigint,
  'expires_at' : [] | [Timestamp],
}
export interface AllowanceArgs { 'account' : Account, 'spender' : Account }
export interface Approve {
  'fee' : [] | [bigint],
  'from' : Account,
  'memo' : [] | [Array<number>],
  'created_at_time' : [] | [Timestamp],
  'amount' : bigint,
  'expected_allowance' : [] | [bigint],
  'expires_at' : [] | [Timestamp],
  'spender' : Account,
}
export interface ApproveArgs {
  'fee' : [] | [bigint],
  'memo' : [] | [Array<number>],
  'from_subaccount' : [] | [Array<number>],
  'created_at_time' : [] | [Timestamp],
  'amount' : bigint,
  'expected_allowance' : [] | [bigint],
  'expires_at' : [] | [Timestamp],
  'spender' : Account,
}
export type ApproveError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'Duplicate' : { 'duplicate_of' : BlockIndex } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'AllowanceChanged' : { 'current_allowance' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : Timestamp } } |
  { 'TooOld' : null } |
  { 'Expired' : { 'ledger_time' : Timestamp } } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export type ApproveResult = { 'Ok' : BlockIndex } |
  { 'Err' : ApproveError };
export type Block = Value;
export type BlockIndex = bigint;
export interface BlockRange { 'blocks' : Array<Block> }
export interface Burn {
  'from' : Account,
  'memo' : [] | [Array<number>],
  'created_at_time' : [] | [Timestamp],
  'amount' : bigint,
  'spender' : [] | [Account],
}
export type ChangeFeeCollector = { 'SetTo' : Account } |
  { 'Unset' : null };
export interface DataCertificate {
  'certificate' : [] | [Array<number>],
  'hash_tree' : Array<number>,
}
export type Duration = bigint;
export interface FeatureFlags { 'icrc2' : boolean }
export interface GetBlocksArgs { 'start' : BlockIndex, 'length' : bigint }
export interface GetBlocksResponse {
  'certificate' : [] | [Array<number>],
  'first_index' : BlockIndex,
  'blocks' : Array<Block>,
  'chain_length' : bigint,
  'archived_blocks' : Array<
    {
      'callback' : QueryBlockArchiveFn,
      'start' : BlockIndex,
      'length' : bigint,
    }
  >,
}
export interface GetTransactionsRequest { 'start' : TxIndex, 'length' : bigint }
export interface GetTransactionsResponse {
  'first_index' : TxIndex,
  'log_length' : bigint,
  'transactions' : Array<Transaction>,
  'archived_transactions' : Array<
    { 'callback' : QueryArchiveFn, 'start' : TxIndex, 'length' : bigint }
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
  'decimals' : [] | [number],
  'token_symbol' : string,
  'transfer_fee' : bigint,
  'metadata' : Array<[string, MetadataValue]>,
  'minting_account' : Account,
  'initial_balances' : Array<[Account, bigint]>,
  'maximum_number_of_accounts' : [] | [bigint],
  'accounts_overflow_trim_quantity' : [] | [bigint],
  'fee_collector_account' : [] | [Account],
  'archive_options' : {
    'num_blocks_to_archive' : bigint,
    'max_transactions_per_response' : [] | [bigint],
    'trigger_threshold' : bigint,
    'max_message_size_bytes' : [] | [bigint],
    'cycles_for_archive_creation' : [] | [bigint],
    'node_max_memory_size_bytes' : [] | [bigint],
    'controller_id' : Principal,
  },
  'max_memo_length' : [] | [number],
  'token_name' : string,
  'feature_flags' : [] | [FeatureFlags],
}
export type LedgerArg = { 'Upgrade' : [] | [UpgradeArgs] } |
  { 'Init' : InitArgs };
export type Map = Array<[string, Value]>;
export type MetadataValue = { 'Int' : bigint } |
  { 'Nat' : bigint } |
  { 'Blob' : Array<number> } |
  { 'Text' : string };
export interface Mint {
  'to' : Account,
  'memo' : [] | [Array<number>],
  'created_at_time' : [] | [Timestamp],
  'amount' : bigint,
}
export type QueryArchiveFn = (arg_0: GetTransactionsRequest) => Promise<
    TransactionRange
  >;
export type QueryBlockArchiveFn = (arg_0: GetBlocksArgs) => Promise<BlockRange>;
export interface StandardRecord { 'url' : string, 'name' : string }
export type Subaccount = Array<number>;
export type Timestamp = bigint;
export type Tokens = bigint;
export interface Transaction {
  'burn' : [] | [Burn],
  'kind' : string,
  'mint' : [] | [Mint],
  'approve' : [] | [Approve],
  'timestamp' : Timestamp,
  'transfer' : [] | [Transfer],
}
export interface TransactionRange { 'transactions' : Array<Transaction> }
export interface Transfer {
  'to' : Account,
  'fee' : [] | [bigint],
  'from' : Account,
  'memo' : [] | [Array<number>],
  'created_at_time' : [] | [Timestamp],
  'amount' : bigint,
  'spender' : [] | [Account],
}
export interface TransferArg {
  'to' : Account,
  'fee' : [] | [Tokens],
  'memo' : [] | [Array<number>],
  'from_subaccount' : [] | [Subaccount],
  'created_at_time' : [] | [Timestamp],
  'amount' : Tokens,
}
export type TransferError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'BadBurn' : { 'min_burn_amount' : Tokens } } |
  { 'Duplicate' : { 'duplicate_of' : BlockIndex } } |
  { 'BadFee' : { 'expected_fee' : Tokens } } |
  { 'CreatedInFuture' : { 'ledger_time' : Timestamp } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : Tokens } };
export interface TransferFromArgs {
  'to' : Account,
  'fee' : [] | [Tokens],
  'spender_subaccount' : [] | [Subaccount],
  'from' : Account,
  'memo' : [] | [Array<number>],
  'created_at_time' : [] | [Timestamp],
  'amount' : Tokens,
}
export type TransferFromError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'InsufficientAllowance' : { 'allowance' : Tokens } } |
  { 'BadBurn' : { 'min_burn_amount' : Tokens } } |
  { 'Duplicate' : { 'duplicate_of' : BlockIndex } } |
  { 'BadFee' : { 'expected_fee' : Tokens } } |
  { 'CreatedInFuture' : { 'ledger_time' : Timestamp } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : Tokens } };
export type TransferFromResult = { 'Ok' : BlockIndex } |
  { 'Err' : TransferFromError };
export type TransferResult = { 'Ok' : BlockIndex } |
  { 'Err' : TransferError };
export type TxIndex = bigint;
export interface UpgradeArgs {
  'token_symbol' : [] | [string],
  'transfer_fee' : [] | [bigint],
  'metadata' : [] | [Array<[string, MetadataValue]>],
  'maximum_number_of_accounts' : [] | [bigint],
  'accounts_overflow_trim_quantity' : [] | [bigint],
  'change_fee_collector' : [] | [ChangeFeeCollector],
  'max_memo_length' : [] | [number],
  'token_name' : [] | [string],
  'feature_flags' : [] | [FeatureFlags],
}
export type Value = { 'Int' : bigint } |
  { 'Map' : Map } |
  { 'Nat' : bigint } |
  { 'Nat64' : bigint } |
  { 'Blob' : Array<number> } |
  { 'Text' : string } |
  { 'Array' : Array<Value> };
export interface _SERVICE {
  'get_blocks' : (arg_0: GetBlocksArgs) => Promise<GetBlocksResponse>,
  'get_data_certificate' : () => Promise<DataCertificate>,
  'get_transactions' : (arg_0: GetTransactionsRequest) => Promise<
      GetTransactionsResponse
    >,
  'icrc1_balance_of' : (arg_0: Account) => Promise<Tokens>,
  'icrc1_decimals' : () => Promise<number>,
  'icrc1_fee' : () => Promise<Tokens>,
  'icrc1_metadata' : () => Promise<Array<[string, MetadataValue]>>,
  'icrc1_minting_account' : () => Promise<[] | [Account]>,
  'icrc1_name' : () => Promise<string>,
  'icrc1_supported_standards' : () => Promise<Array<StandardRecord>>,
  'icrc1_symbol' : () => Promise<string>,
  'icrc1_total_supply' : () => Promise<Tokens>,
  'icrc1_transfer' : (arg_0: TransferArg) => Promise<TransferResult>,
  'icrc2_allowance' : (arg_0: AllowanceArgs) => Promise<Allowance>,
  'icrc2_approve' : (arg_0: ApproveArgs) => Promise<ApproveResult>,
  'icrc2_transfer_from' : (arg_0: TransferFromArgs) => Promise<
      TransferFromResult
    >,
}
