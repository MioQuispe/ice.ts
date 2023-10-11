import type { Principal } from '@dfinity/principal';
export type AddTentativeDeviceResponse = {
    'device_registration_mode_off' : null
  } |
  { 'another_device_tentatively_added' : null } |
  {
    'added_tentatively' : {
      'verification_code' : string,
      'device_registration_timeout' : bigint,
    }
  };
export interface AppInfo {
  'app_id' : string,
  'current_version' : Version,
  'latest_version' : Version,
  'wallet_id' : [] | [Principal],
}
export type AppType = { 'android_app' : null } |
  { 'mobile_extension' : null } |
  { 'mobile_browser' : null } |
  { 'desktop_extension' : null } |
  { 'desktop_browser' : null } |
  { 'desktop_app' : null } |
  { 'ios_app' : null };
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
export interface Delegation {
  'pubkey' : Array<number>,
  'targets' : [] | [Array<Principal>],
  'expiration' : bigint,
}
export type DelegationMode = { 'domain' : null } |
  { 'global' : null };
export type DeviceAddResponse = {
    'added' : { 'user_name' : string, 'user_id' : string }
  } |
  { 'failed' : null };
export interface DeviceDataExternal {
  'os_type' : [] | [AppType],
  'device_name' : string,
  'device_type' : DeviceType,
  'pub_key' : Array<number>,
  'enable_e2e' : [] | [boolean],
  'purpose' : Purpose,
  'credential_id' : [] | [Array<number>],
  'resolver_id' : [] | [string],
}
export interface DeviceDataExternalV1 {
  'device_type' : DeviceType,
  'pub_key' : Array<number>,
  'credential_id' : [] | [Array<number>],
}
export type DeviceRemoveResponse = { 'failed' : null } |
  { 'removed' : null };
export type DeviceType = { 'IdentityProvider' : null } |
  { 'RecoveryPhrase' : null } |
  { 'SecurityDevice' : null } |
  { 'Google' : null } |
  { 'EthereumMetaMask' : null };
export type DeviceUpdateResponse = { 'updated' : null } |
  { 'failed' : null };
export interface E2EDeviceRequest {
  'meta' : [] | [Array<number>],
  'enc_doc' : [] | [EncDoc],
  'pub_key' : Array<number>,
}
export interface EncDoc {
  'data' : Array<number>,
  'meta' : [] | [Array<number>],
  'manager_pub_key' : Array<number>,
}
export type GetDelegationResponse = { 'no_such_delegation' : null } |
  { 'signed_delegation' : SignedDelegation };
export interface HardwareWalletAccountDetails {
  'principal' : Principal,
  'name' : string,
  'account_identifier' : string,
}
export type InstallControllerResponse = { 'success' : Principal } |
  { 'failed' : null };
export interface LogEntry { 'ts' : bigint, 'msg' : string, 'kind' : string }
export interface MEAccountDetails {
  'principal' : Principal,
  'active' : boolean,
  'account_identifier' : string,
  'hardware_wallet_accounts' : Array<HardwareWalletAccountDetails>,
  'wallet_name' : string,
  'sub_accounts' : Array<SubAccountDetails>,
}
export interface MEUser {
  'user_number' : bigint,
  'user_name' : string,
  'ego_controller' : [] | [Principal],
  'e2e_id' : [] | [bigint],
  'user_id' : [] | [string],
  'tentative' : [] | [TentativeDeviceRegistration],
  'devices' : Array<DeviceDataExternal>,
  'last_update' : bigint,
}
export interface MeError { 'msg' : string, 'code' : number }
export interface NNSAccountDetails {
  'principal' : Principal,
  'active' : boolean,
  'account_identifier' : string,
  'hardware_wallet_accounts' : Array<HardwareWalletAccountDetails>,
  'ii_anchor' : string,
  'sub_accounts' : Array<SubAccountDetails>,
}
export interface PrepareDelegationResponse {
  'user_key' : Array<number>,
  'expiration' : bigint,
}
export type Purpose = { 'authentication' : null } |
  { 'recovery' : null } |
  { 'management' : null };
export interface RegisterEvent {
  'user_name' : string,
  'device_name' : string,
  'device_type' : DeviceType,
  'os_version' : string,
  'os_name' : string,
}
export type RegisterResponse = { 'existed' : { 'user_name' : string } } |
  { 'canister_full' : null } |
  { 'registered' : { 'user_name' : string, 'user_id' : string } };
export type RegistrationState = { 'DeviceRegistrationModeActive' : null } |
  {
    'DeviceTentativelyAdded' : {
      'failed_attempts' : number,
      'tentative_device' : DeviceDataExternal,
      'verification_code' : string,
      'tentative_principal' : Principal,
    }
  };
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : BackupInfo } |
  { 'Err' : string };
export type Result_10 = { 'Ok' : AppInfo } |
  { 'Err' : string };
export type Result_11 = { 'Ok' : Array<[string, Array<Principal>]> } |
  { 'Err' : string };
export type Result_12 = { 'Ok' : Array<CycleRecord> } |
  { 'Err' : string };
export type Result_13 = { 'Ok' : CycleInfo } |
  { 'Err' : string };
export type Result_14 = { 'Ok' : Array<LogEntry> } |
  { 'Err' : string };
export type Result_15 = { 'Ok' : [] | [Array<[Principal, string]>] } |
  { 'Err' : string };
export type Result_16 = { 'Ok' : [] | [ByteReadResponse] } |
  { 'Err' : string };
export type Result_17 = { 'Ok' : string } |
  { 'Err' : MeError };
export type Result_2 = { 'Ok' : Array<BackupJob> } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : boolean } |
  { 'Err' : MeError };
export type Result_5 = { 'Ok' : null } |
  { 'Err' : MeError };
export type Result_6 = { 'Ok' : AddTentativeDeviceResponse } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : bigint } |
  { 'Err' : string };
export type Result_8 = { 'Ok' : boolean } |
  { 'Err' : string };
export type Result_9 = { 'Ok' : VerifyTentativeDeviceResponse } |
  { 'Err' : string };
export interface SignedDelegation {
  'signature' : Array<number>,
  'delegation' : Delegation,
}
export interface SubAccountDetails {
  'name' : string,
  'payment_limit' : [] | [bigint],
  'sub_account' : Array<number>,
  'account_identifier' : string,
}
export interface TentativeDeviceRegistration {
  'state' : RegistrationState,
  'expiration' : bigint,
}
export type UpdateMEWalletResponse = { 'success' : null } |
  { 'failed' : null };
export type VerifyTentativeDeviceResponse = {
    'device_registration_mode_off' : null
  } |
  { 'verified' : null } |
  { 'wrong_code' : { 'retries_left' : number } } |
  { 'no_device_to_verify' : null };
export type VerifyTentativeMode = { 'active' : null } |
  { 'passive' : null };
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface _SERVICE {
  'admin_e2e_reset' : (arg_0: string) => Promise<undefined>,
  'admin_list_missing_id_users' : () => Promise<Array<string>>,
  'admin_salt_get' : () => Promise<[] | [Array<number>]>,
  'admin_salt_set' : (arg_0: Array<number>) => Promise<undefined>,
  'admin_user_id_update' : (arg_0: bigint) => Promise<string>,
  'admin_user_id_update_batch' : (arg_0: bigint, arg_1: bigint) => Promise<
      Result
    >,
  'admin_user_info_get' : (arg_0: bigint) => Promise<MEUser>,
  'backup_change_status' : (arg_0: BackupStatus) => Promise<Result>,
  'backup_info_get' : () => Promise<Result_1>,
  'backup_job_list' : () => Promise<Result_2>,
  'balance_get' : () => Promise<Result_3>,
  'controller_user_get' : (arg_0: string) => Promise<[] | [Principal]>,
  'controller_user_install' : (arg_0: string) => Promise<
      InstallControllerResponse
    >,
  'controller_user_upgrade' : () => Promise<undefined>,
  'device_e2e_add' : (arg_0: string, arg_1: E2EDeviceRequest) => Promise<
      DeviceAddResponse
    >,
  'device_e2e_manage_pub_key_exists' : (
      arg_0: string,
      arg_1: Array<number>,
    ) => Promise<Result_4>,
  'device_main_add' : (
      arg_0: string,
      arg_1: DeviceDataExternal,
      arg_2: [] | [E2EDeviceRequest],
    ) => Promise<DeviceAddResponse>,
  'device_main_get' : (arg_0: string, arg_1: [] | [DeviceType]) => Promise<
      Array<DeviceDataExternal>
    >,
  'device_main_get_v1' : (arg_0: string, arg_1: [] | [DeviceType]) => Promise<
      Array<DeviceDataExternalV1>
    >,
  'device_main_get_v2' : (arg_0: string, arg_1: [] | [DeviceType]) => Promise<
      Array<DeviceDataExternal>
    >,
  'device_main_recovery' : (
      arg_0: string,
      arg_1: DeviceDataExternal,
      arg_2: [] | [E2EDeviceRequest],
    ) => Promise<DeviceAddResponse>,
  'device_main_remove' : (arg_0: string, arg_1: Array<number>) => Promise<
      DeviceRemoveResponse
    >,
  'device_main_update' : (arg_0: string, arg_1: DeviceDataExternal) => Promise<
      DeviceUpdateResponse
    >,
  'device_main_update_self' : (
      arg_0: string,
      arg_1: string,
      arg_2: [] | [EncDoc],
      arg_3: [] | [Array<number>],
    ) => Promise<Result_5>,
  'device_tentative_add' : (
      arg_0: string,
      arg_1: Principal,
      arg_2: DeviceDataExternal,
    ) => Promise<Result_6>,
  'device_tentative_enter' : (arg_0: string) => Promise<Result_7>,
  'device_tentative_exit' : (arg_0: string) => Promise<Result_8>,
  'device_tentative_has' : (arg_0: string) => Promise<boolean>,
  'device_tentative_verify' : (
      arg_0: string,
      arg_1: string,
      arg_2: VerifyTentativeMode,
      arg_3: [] | [EncDoc],
    ) => Promise<Result_9>,
  'ego_app_info_get' : () => Promise<Result_10>,
  'ego_app_info_update' : (
      arg_0: [] | [Principal],
      arg_1: string,
      arg_2: Version,
    ) => Promise<undefined>,
  'ego_app_version_check' : () => Promise<Result_10>,
  'ego_canister_add' : (arg_0: string, arg_1: Principal) => Promise<Result>,
  'ego_canister_delete' : () => Promise<Result>,
  'ego_canister_list' : () => Promise<Result_11>,
  'ego_canister_remove' : (arg_0: string, arg_1: Principal) => Promise<Result>,
  'ego_canister_track' : () => Promise<Result>,
  'ego_canister_untrack' : () => Promise<Result>,
  'ego_canister_upgrade' : () => Promise<Result>,
  'ego_controller_add' : (arg_0: Principal) => Promise<Result>,
  'ego_controller_remove' : (arg_0: Principal) => Promise<Result>,
  'ego_controller_set' : (arg_0: Array<Principal>) => Promise<Result>,
  'ego_cycle_check' : () => Promise<Result>,
  'ego_cycle_estimate_set' : (arg_0: bigint) => Promise<Result>,
  'ego_cycle_history' : () => Promise<Result_12>,
  'ego_cycle_info' : () => Promise<Result_13>,
  'ego_cycle_recharge' : (arg_0: bigint) => Promise<Result>,
  'ego_cycle_threshold_get' : () => Promise<Result_3>,
  'ego_is_op' : () => Promise<Result_8>,
  'ego_is_owner' : () => Promise<Result_8>,
  'ego_is_user' : () => Promise<Result_8>,
  'ego_log_list' : (arg_0: bigint) => Promise<Result_14>,
  'ego_op_add' : (arg_0: Principal) => Promise<Result>,
  'ego_op_list' : () => Promise<Result_15>,
  'ego_op_remove' : (arg_0: Principal) => Promise<Result>,
  'ego_owner_add' : (arg_0: Principal) => Promise<Result>,
  'ego_owner_add_with_name' : (arg_0: string, arg_1: Principal) => Promise<
      Result
    >,
  'ego_owner_list' : () => Promise<Result_15>,
  'ego_owner_remove' : (arg_0: Principal) => Promise<Result>,
  'ego_owner_set' : (arg_0: Array<Principal>) => Promise<Result>,
  'ego_runtime_cycle_threshold_get' : () => Promise<Result_3>,
  'ego_user_add' : (arg_0: Principal) => Promise<Result>,
  'ego_user_list' : () => Promise<Result_15>,
  'ego_user_remove' : (arg_0: Principal) => Promise<Result>,
  'ego_user_set' : (arg_0: Array<Principal>) => Promise<Result>,
  'finish_backup' : () => Promise<undefined>,
  'finish_restore' : () => Promise<undefined>,
  'id_delegation_get' : (
      arg_0: string,
      arg_1: string,
      arg_2: Array<number>,
      arg_3: DelegationMode,
      arg_4: bigint,
      arg_5: [] | [Array<Principal>],
      arg_6: boolean,
    ) => Promise<GetDelegationResponse>,
  'id_delegation_prepare' : (
      arg_0: string,
      arg_1: string,
      arg_2: Array<number>,
      arg_3: DelegationMode,
      arg_4: [] | [bigint],
      arg_5: [] | [Array<Principal>],
      arg_6: boolean,
    ) => Promise<PrepareDelegationResponse>,
  'id_user_add' : (
      arg_0: string,
      arg_1: DeviceDataExternal,
      arg_2: RegisterEvent,
      arg_3: [] | [E2EDeviceRequest],
    ) => Promise<RegisterResponse>,
  'is_username_exists' : (arg_0: string) => Promise<boolean>,
  'job_data_export' : (
      arg_0: string,
      arg_1: bigint,
      arg_2: bigint,
      arg_3: [] | [BackupExportFormat],
      arg_4: [] | [bigint],
    ) => Promise<Result_16>,
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
  'jwt_token_get' : (arg_0: string) => Promise<[] | [string]>,
  'start_backup' : () => Promise<undefined>,
  'start_restore' : (arg_0: Array<BackupJob>) => Promise<undefined>,
  'user_name_to_user_id' : (arg_0: string) => Promise<Result_17>,
  'wallet_me_add' : (arg_0: string, arg_1: MEAccountDetails) => Promise<
      UpdateMEWalletResponse
    >,
  'wallet_me_remove' : (arg_0: string, arg_1: Principal) => Promise<
      UpdateMEWalletResponse
    >,
  'wallet_nns_add' : (arg_0: string, arg_1: NNSAccountDetails) => Promise<
      UpdateMEWalletResponse
    >,
  'wallet_nns_remove' : (arg_0: string, arg_1: string) => Promise<
      UpdateMEWalletResponse
    >,
}
