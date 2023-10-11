import type { Principal } from '@dfinity/principal';
export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [SubAccount],
}
export interface AccountBalanceArgs { 'account' : AccountIdentifier }
export interface AccountBalanceArgsDfx { 'account' : TextAccountIdentifier }
export type AccountIdentifier = Array<number>;
export interface Allowance {
  'allowance' : Icrc1Tokens,
  'expires_at' : [] | [TimeStamp],
}
export interface AllowanceArgs { 'account' : Account, 'spender' : Account }
export interface ApproveArgs {
  'fee' : [] | [Icrc1Tokens],
  'memo' : [] | [Array<number>],
  'from_subaccount' : [] | [SubAccount],
  'created_at_time' : [] | [TimeStamp],
  'amount' : Icrc1Tokens,
  'expected_allowance' : [] | [Icrc1Tokens],
  'expires_at' : [] | [TimeStamp],
  'spender' : Account,
}
export type ApproveError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'Duplicate' : { 'duplicate_of' : Icrc1BlockIndex } } |
  { 'BadFee' : { 'expected_fee' : Icrc1Tokens } } |
  { 'AllowanceChanged' : { 'current_allowance' : Icrc1Tokens } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'Expired' : { 'ledger_time' : bigint } } |
  { 'InsufficientFunds' : { 'balance' : Icrc1Tokens } };
export type ApproveResult = { 'Ok' : Icrc1BlockIndex } |
  { 'Err' : ApproveError };
export interface Archive { 'canister_id' : Principal }
export interface ArchiveOptions {
  'num_blocks_to_archive' : bigint,
  'trigger_threshold' : bigint,
  'max_message_size_bytes' : [] | [bigint],
  'cycles_for_archive_creation' : [] | [bigint],
  'node_max_memory_size_bytes' : [] | [bigint],
  'controller_id' : Principal,
}
export interface ArchivedBlocksRange {
  'callback' : QueryArchiveFn,
  'start' : BlockIndex,
  'length' : bigint,
}
export interface ArchivedEncodedBlocksRange {
  'callback' : [Principal, string],
  'start' : bigint,
  'length' : bigint,
}
export interface Archives { 'archives' : Array<Archive> }
export interface Block {
  'transaction' : Transaction,
  'timestamp' : TimeStamp,
  'parent_hash' : [] | [Array<number>],
}
export type BlockIndex = bigint;
export interface BlockRange { 'blocks' : Array<Block> }
export interface Duration { 'secs' : bigint, 'nanos' : number }
export interface FeatureFlags { 'icrc2' : boolean }
export interface GetBlocksArgs { 'start' : BlockIndex, 'length' : bigint }
export type Icrc1BlockIndex = bigint;
export type Icrc1Timestamp = bigint;
export type Icrc1Tokens = bigint;
export type Icrc1TransferError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'BadBurn' : { 'min_burn_amount' : Icrc1Tokens } } |
  { 'Duplicate' : { 'duplicate_of' : Icrc1BlockIndex } } |
  { 'BadFee' : { 'expected_fee' : Icrc1Tokens } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : Icrc1Tokens } };
export type Icrc1TransferResult = { 'Ok' : Icrc1BlockIndex } |
  { 'Err' : Icrc1TransferError };
export interface InitArgs {
  'send_whitelist' : Array<Principal>,
  'token_symbol' : [] | [string],
  'transfer_fee' : [] | [Tokens],
  'minting_account' : TextAccountIdentifier,
  'maximum_number_of_accounts' : [] | [bigint],
  'accounts_overflow_trim_quantity' : [] | [bigint],
  'transaction_window' : [] | [Duration],
  'max_message_size_bytes' : [] | [bigint],
  'icrc1_minting_account' : [] | [Account],
  'archive_options' : [] | [ArchiveOptions],
  'initial_values' : Array<[TextAccountIdentifier, Tokens]>,
  'token_name' : [] | [string],
  'feature_flags' : [] | [FeatureFlags],
}
export type LedgerCanisterPayload = { 'Upgrade' : [] | [UpgradeArgs] } |
  { 'Init' : InitArgs };
export type Memo = bigint;
export type Operation = {
    'Approve' : {
      'fee' : Tokens,
      'from' : AccountIdentifier,
      'allowance_e8s' : bigint,
      'allowance' : Tokens,
      'expires_at' : [] | [TimeStamp],
      'spender' : AccountIdentifier,
    }
  } |
  {
    'Burn' : {
      'from' : AccountIdentifier,
      'amount' : Tokens,
      'spender' : [] | [AccountIdentifier],
    }
  } |
  { 'Mint' : { 'to' : AccountIdentifier, 'amount' : Tokens } } |
  {
    'Transfer' : {
      'to' : AccountIdentifier,
      'fee' : Tokens,
      'from' : AccountIdentifier,
      'amount' : Tokens,
    }
  } |
  {
    'TransferFrom' : {
      'to' : AccountIdentifier,
      'fee' : Tokens,
      'from' : AccountIdentifier,
      'amount' : Tokens,
      'spender' : AccountIdentifier,
    }
  };
export type QueryArchiveError = {
    'BadFirstBlockIndex' : {
      'requested_index' : BlockIndex,
      'first_valid_index' : BlockIndex,
    }
  } |
  { 'Other' : { 'error_message' : string, 'error_code' : bigint } };
export type QueryArchiveFn = (arg_0: GetBlocksArgs) => Promise<
    QueryArchiveResult
  >;
export type QueryArchiveResult = { 'Ok' : BlockRange } |
  { 'Err' : QueryArchiveError };
export interface QueryBlocksResponse {
  'certificate' : [] | [Array<number>],
  'blocks' : Array<Block>,
  'chain_length' : bigint,
  'first_block_index' : BlockIndex,
  'archived_blocks' : Array<ArchivedBlocksRange>,
}
export interface QueryEncodedBlocksResponse {
  'certificate' : [] | [Array<number>],
  'blocks' : Array<Array<number>>,
  'chain_length' : bigint,
  'first_block_index' : bigint,
  'archived_blocks' : Array<ArchivedEncodedBlocksRange>,
}
export interface SendArgs {
  'to' : TextAccountIdentifier,
  'fee' : Tokens,
  'memo' : Memo,
  'from_subaccount' : [] | [SubAccount],
  'created_at_time' : [] | [TimeStamp],
  'amount' : Tokens,
}
export type SubAccount = Array<number>;
export type TextAccountIdentifier = string;
export interface TimeStamp { 'timestamp_nanos' : bigint }
export interface Tokens { 'e8s' : bigint }
export interface Transaction {
  'memo' : Memo,
  'icrc1_memo' : [] | [Array<number>],
  'operation' : [] | [Operation],
  'created_at_time' : TimeStamp,
}
export interface TransferArg {
  'to' : Account,
  'fee' : [] | [Icrc1Tokens],
  'memo' : [] | [Array<number>],
  'from_subaccount' : [] | [SubAccount],
  'created_at_time' : [] | [Icrc1Timestamp],
  'amount' : Icrc1Tokens,
}
export interface TransferArgs {
  'to' : AccountIdentifier,
  'fee' : Tokens,
  'memo' : Memo,
  'from_subaccount' : [] | [SubAccount],
  'created_at_time' : [] | [TimeStamp],
  'amount' : Tokens,
}
export type TransferError = {
    'TxTooOld' : { 'allowed_window_nanos' : bigint }
  } |
  { 'BadFee' : { 'expected_fee' : Tokens } } |
  { 'TxDuplicate' : { 'duplicate_of' : BlockIndex } } |
  { 'TxCreatedInFuture' : null } |
  { 'InsufficientFunds' : { 'balance' : Tokens } };
export interface TransferFee { 'transfer_fee' : Tokens }
export type TransferFeeArg = {};
export type TransferResult = { 'Ok' : BlockIndex } |
  { 'Err' : TransferError };
export interface UpgradeArgs {
  'maximum_number_of_accounts' : [] | [bigint],
  'icrc1_minting_account' : [] | [Account],
  'feature_flags' : [] | [FeatureFlags],
}
export type Value = { 'Int' : bigint } |
  { 'Nat' : bigint } |
  { 'Blob' : Array<number> } |
  { 'Text' : string };
export interface _SERVICE {
  'account_balance' : (arg_0: AccountBalanceArgs) => Promise<Tokens>,
  'account_balance_dfx' : (arg_0: AccountBalanceArgsDfx) => Promise<Tokens>,
  'archives' : () => Promise<Archives>,
  'decimals' : () => Promise<{ 'decimals' : number }>,
  'icrc1_balance_of' : (arg_0: Account) => Promise<Icrc1Tokens>,
  'icrc1_decimals' : () => Promise<number>,
  'icrc1_fee' : () => Promise<Icrc1Tokens>,
  'icrc1_metadata' : () => Promise<Array<[string, Value]>>,
  'icrc1_minting_account' : () => Promise<[] | [Account]>,
  'icrc1_name' : () => Promise<string>,
  'icrc1_supported_standards' : () => Promise<
      Array<{ 'url' : string, 'name' : string }>
    >,
  'icrc1_symbol' : () => Promise<string>,
  'icrc1_total_supply' : () => Promise<Icrc1Tokens>,
  'icrc1_transfer' : (arg_0: TransferArg) => Promise<Icrc1TransferResult>,
  'icrc2_allowance' : (arg_0: AllowanceArgs) => Promise<Allowance>,
  'icrc2_approve' : (arg_0: ApproveArgs) => Promise<ApproveResult>,
  'name' : () => Promise<{ 'name' : string }>,
  'query_blocks' : (arg_0: GetBlocksArgs) => Promise<QueryBlocksResponse>,
  'query_encoded_blocks' : (arg_0: GetBlocksArgs) => Promise<
      QueryEncodedBlocksResponse
    >,
  'send_dfx' : (arg_0: SendArgs) => Promise<BlockIndex>,
  'symbol' : () => Promise<{ 'symbol' : string }>,
  'transfer' : (arg_0: TransferArgs) => Promise<TransferResult>,
  'transfer_fee' : (arg_0: TransferFeeArg) => Promise<TransferFee>,
}
