import type { Principal } from '@dfinity/principal';
export interface AppInfo {
  'app_id' : string,
  'current_version' : Version,
  'latest_version' : Version,
  'wallet_id' : [] | [Principal],
}
export type BackupExportFormat = { 'JSON' : null } |
  { 'BINARY' : null };
export interface BackupInfo {
  'state' : BackupStatus,
  'last_backup' : bigint,
  'recent_backup' : [] | [bigint],
}
export interface BackupJob { 'name' : string, 'amount' : bigint }
export type BackupStatus = { 'MAINTAINING' : null } |
  { 'RUNNING' : null };
export interface ByteReadResponse {
  'data' : Array<number>,
  'hash' : string,
  'name' : string,
}
export interface ByteWriteRequest {
  'end' : bigint,
  'data' : Array<number>,
  'hash' : string,
  'name' : string,
  'start' : bigint,
  'format' : [] | [BackupExportFormat],
}
export interface CycleInfo {
  'records' : Array<CycleRecord>,
  'estimate_remaining' : bigint,
}
export interface CycleRecord { 'ts' : bigint, 'balance' : bigint }
export interface LogEntry { 'ts' : bigint, 'msg' : string, 'kind' : string }
export interface PlatformStatistics {
  'user_count' : bigint,
  'me_count' : bigint,
  'nns_count' : bigint,
  'device_count' : bigint,
}
export interface Record {
  'id' : bigint,
  'create_at' : bigint,
  'user' : string,
  'event' : string,
  'scope' : string,
  'message' : string,
}
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : BackupInfo } |
  { 'Err' : string };
export type Result_10 = { 'Ok' : [] | [Array<[Principal, string]>] } |
  { 'Err' : string };
export type Result_11 = { 'Ok' : [] | [ByteReadResponse] } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : Array<BackupJob> } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : AppInfo } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : Array<[string, Array<Principal>]> } |
  { 'Err' : string };
export type Result_6 = { 'Ok' : Array<CycleRecord> } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : CycleInfo } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : boolean } |
  { 'Err' : string };
export type Result_9 = { 'Ok' : Array<LogEntry> } |
  { 'Err' : string };
export interface UserGraph {
  'me_count' : bigint,
  'user_number' : bigint,
  'nns_count' : bigint,
  'device_count' : bigint,
}
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface _SERVICE {
  'add_records' : (
      arg_0: string,
      arg_1: string,
      arg_2: string,
      arg_3: string,
    ) => Promise<bigint>,
  'backup_change_status' : (arg_0: BackupStatus) => Promise<Result>,
  'backup_info_get' : () => Promise<Result_1>,
  'backup_job_list' : () => Promise<Result_2>,
  'balance_get' : () => Promise<Result_3>,
  'clear_records' : (arg_0: bigint) => Promise<bigint>,
  'clear_records_by_id' : (arg_0: bigint) => Promise<bigint>,
  'count_records' : () => Promise<bigint>,
  'ego_app_info_get' : () => Promise<Result_4>,
  'ego_app_info_update' : (
      arg_0: [] | [Principal],
      arg_1: string,
      arg_2: Version,
    ) => Promise<undefined>,
  'ego_app_version_check' : () => Promise<Result_4>,
  'ego_canister_add' : (arg_0: string, arg_1: Principal) => Promise<Result>,
  'ego_canister_delete' : () => Promise<Result>,
  'ego_canister_list' : () => Promise<Result_5>,
  'ego_canister_remove' : (arg_0: string, arg_1: Principal) => Promise<Result>,
  'ego_canister_track' : () => Promise<Result>,
  'ego_canister_untrack' : () => Promise<Result>,
  'ego_canister_upgrade' : () => Promise<Result>,
  'ego_controller_add' : (arg_0: Principal) => Promise<Result>,
  'ego_controller_remove' : (arg_0: Principal) => Promise<Result>,
  'ego_controller_set' : (arg_0: Array<Principal>) => Promise<Result>,
  'ego_cycle_check' : () => Promise<Result>,
  'ego_cycle_estimate_set' : (arg_0: bigint) => Promise<Result>,
  'ego_cycle_history' : () => Promise<Result_6>,
  'ego_cycle_info' : () => Promise<Result_7>,
  'ego_cycle_recharge' : (arg_0: bigint) => Promise<Result>,
  'ego_cycle_threshold_get' : () => Promise<Result_3>,
  'ego_is_op' : () => Promise<Result_8>,
  'ego_is_owner' : () => Promise<Result_8>,
  'ego_is_user' : () => Promise<Result_8>,
  'ego_log_list' : (arg_0: bigint) => Promise<Result_9>,
  'ego_op_add' : (arg_0: Principal) => Promise<Result>,
  'ego_op_list' : () => Promise<Result_10>,
  'ego_op_remove' : (arg_0: Principal) => Promise<Result>,
  'ego_owner_add' : (arg_0: Principal) => Promise<Result>,
  'ego_owner_add_with_name' : (arg_0: string, arg_1: Principal) => Promise<
      Result
    >,
  'ego_owner_list' : () => Promise<Result_10>,
  'ego_owner_remove' : (arg_0: Principal) => Promise<Result>,
  'ego_owner_set' : (arg_0: Array<Principal>) => Promise<Result>,
  'ego_runtime_cycle_threshold_get' : () => Promise<Result_3>,
  'ego_user_add' : (arg_0: Principal) => Promise<Result>,
  'ego_user_list' : () => Promise<Result_10>,
  'ego_user_remove' : (arg_0: Principal) => Promise<Result>,
  'ego_user_set' : (arg_0: Array<Principal>) => Promise<Result>,
  'finish_backup' : () => Promise<undefined>,
  'finish_restore' : () => Promise<undefined>,
  'get_records' : (
      arg_0: [] | [string],
      arg_1: bigint,
      arg_2: bigint,
    ) => Promise<Array<Record>>,
  'job_data_export' : (
      arg_0: string,
      arg_1: bigint,
      arg_2: bigint,
      arg_3: [] | [BackupExportFormat],
      arg_4: [] | [bigint],
    ) => Promise<Result_11>,
  'job_data_import' : (arg_0: ByteWriteRequest) => Promise<Result_8>,
  'job_data_read' : (arg_0: string, arg_1: bigint, arg_2: bigint) => Promise<
      Result_8
    >,
  'job_data_write' : (
      arg_0: string,
      arg_1: bigint,
      arg_2: bigint,
      arg_3: boolean,
    ) => Promise<Result_8>,
  'platform_statistics' : () => Promise<PlatformStatistics>,
  'start_backup' : () => Promise<undefined>,
  'start_restore' : (arg_0: Array<BackupJob>) => Promise<undefined>,
  'users_statistics' : () => Promise<Array<[string, UserGraph]>>,
}
