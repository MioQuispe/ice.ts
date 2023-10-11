import type { Principal } from '@dfinity/principal';
export interface AdminAppCreateBackendRequest {
  'logo' : string,
  'name' : string,
  'description' : string,
  'version' : Version,
  'app_id' : string,
  'category' : Category,
  'backend_data_hash' : string,
  'backend_data' : Array<number>,
}
export interface App {
  'logo' : string,
  'name' : string,
  'description' : string,
  'app_id' : string,
  'app_hash' : string,
  'category' : Category,
  'current_version' : Version,
  'price' : number,
}
export interface AppMainNewRequest {
  'logo' : string,
  'name' : string,
  'description' : string,
  'app_id' : string,
  'category' : Category,
  'price' : number,
}
export interface AppVersion {
  'status' : AppVersionStatus,
  'wasm' : [] | [Wasm],
  'version' : Version,
  'app_id' : string,
  'file_id' : Principal,
}
export interface AppVersionSetFrontendAddressRequest {
  'canister_id' : Principal,
  'version' : Version,
  'app_id' : string,
}
export type AppVersionStatus = { 'NEW' : null } |
  { 'REJECTED' : null } |
  { 'SUBMITTED' : null } |
  { 'REVOKED' : null } |
  { 'RELEASED' : null } |
  { 'APPROVED' : null };
export interface AppVersionUploadWasmRequest {
  'data' : Array<number>,
  'hash' : string,
  'version' : Version,
  'app_id' : string,
}
export type CanisterType = { 'BACKEND' : null } |
  { 'ASSET' : null };
export type Category = { 'System' : null } |
  { 'Vault' : null };
export interface CycleInfo {
  'records' : Array<CycleRecord>,
  'estimate_remaining' : bigint,
}
export interface CycleRecord { 'ts' : bigint, 'balance' : bigint }
export interface Developer {
  'name' : string,
  'is_app_auditor' : boolean,
  'developer_id' : Principal,
  'created_apps' : Array<string>,
  'is_manager' : boolean,
}
export interface EgoDevApp {
  'app' : App,
  'developer_id' : Principal,
  'versions' : Array<AppVersion>,
  'audit_version' : [] | [Version],
}
export interface EgoError { 'msg' : string, 'code' : number }
export interface InitArg { 'init_caller' : [] | [Principal] }
export type Result = { 'Ok' : AppVersion } |
  { 'Err' : EgoError };
export type Result_1 = { 'Ok' : boolean } |
  { 'Err' : EgoError };
export type Result_10 = { 'Ok' : Array<Developer> } |
  { 'Err' : EgoError };
export type Result_2 = { 'Ok' : Array<EgoDevApp> } |
  { 'Err' : EgoError };
export type Result_3 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : EgoDevApp } |
  { 'Err' : EgoError };
export type Result_5 = { 'Ok' : Developer } |
  { 'Err' : EgoError };
export type Result_6 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : Array<CycleRecord> } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : CycleInfo } |
  { 'Err' : string };
export type Result_9 = { 'Ok' : Array<string> } |
  { 'Err' : string };
export interface UserRoleSetRequest {
  'user_id' : Principal,
  'is_app_auditor' : boolean,
  'is_manager' : boolean,
}
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
  'admin_app_create' : (arg_0: AdminAppCreateBackendRequest) => Promise<Result>,
  'app_version_approve' : (arg_0: string, arg_1: Version) => Promise<Result>,
  'app_version_new' : (arg_0: string, arg_1: Version) => Promise<Result>,
  'app_version_reject' : (arg_0: string, arg_1: Version) => Promise<Result>,
  'app_version_release' : (arg_0: string, arg_1: Version) => Promise<Result>,
  'app_version_revoke' : (arg_0: string, arg_1: Version) => Promise<Result>,
  'app_version_set_frontend_address' : (
      arg_0: AppVersionSetFrontendAddressRequest,
    ) => Promise<Result_1>,
  'app_version_submit' : (arg_0: string, arg_1: Version) => Promise<Result>,
  'app_version_upload_wasm' : (arg_0: AppVersionUploadWasmRequest) => Promise<
      Result_1
    >,
  'app_version_wait_for_audit' : () => Promise<Result_2>,
  'balance_get' : () => Promise<Result_3>,
  'developer_app_get' : (arg_0: string) => Promise<Result_4>,
  'developer_app_list' : () => Promise<Result_2>,
  'developer_app_new' : (arg_0: AppMainNewRequest) => Promise<Result_4>,
  'developer_main_get' : () => Promise<Result_5>,
  'developer_main_register' : (arg_0: string) => Promise<Result_5>,
  'ego_canister_add' : (arg_0: string, arg_1: Principal) => Promise<Result_6>,
  'ego_controller_add' : (arg_0: Principal) => Promise<Result_6>,
  'ego_controller_remove' : (arg_0: Principal) => Promise<Result_6>,
  'ego_controller_set' : (arg_0: Array<Principal>) => Promise<Result_6>,
  'ego_cycle_check' : () => Promise<Result_6>,
  'ego_cycle_estimate_set' : (arg_0: bigint) => Promise<Result_6>,
  'ego_cycle_history' : () => Promise<Result_7>,
  'ego_cycle_info' : () => Promise<Result_8>,
  'ego_cycle_recharge' : (arg_0: bigint) => Promise<Result_6>,
  'ego_cycle_threshold_get' : () => Promise<Result_3>,
  'ego_log_list' : (arg_0: bigint) => Promise<Result_9>,
  'ego_op_add' : (arg_0: Principal) => Promise<Result_6>,
  'ego_owner_add' : (arg_0: Principal) => Promise<Result_6>,
  'ego_owner_remove' : (arg_0: Principal) => Promise<Result_6>,
  'ego_owner_set' : (arg_0: Array<Principal>) => Promise<Result_6>,
  'ego_user_add' : (arg_0: Principal) => Promise<Result_6>,
  'ego_user_remove' : (arg_0: Principal) => Promise<Result_6>,
  'ego_user_set' : (arg_0: Array<Principal>) => Promise<Result_6>,
  'user_main_list' : (arg_0: string) => Promise<Result_10>,
  'user_role_set' : (arg_0: UserRoleSetRequest) => Promise<Result_1>,
}
