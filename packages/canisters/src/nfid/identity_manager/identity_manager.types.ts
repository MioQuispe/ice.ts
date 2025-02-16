import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AccessPointRemoveRequest { 'pub_key' : string }
export interface AccessPointRequest {
  'icon' : string,
  'device_type' : DeviceType,
  'device' : string,
  'pub_key' : string,
  'browser' : string,
  'credential_id' : [] | [string],
}
export interface AccessPointResponse {
  'icon' : string,
  'device_type' : DeviceType,
  'device' : string,
  'browser' : string,
  'last_used' : bigint,
  'principal_id' : string,
  'credential_id' : [] | [string],
}
export interface Account {
  'name' : [] | [string],
  'anchor' : bigint,
  'access_points' : Array<AccessPointRequest>,
  'email' : [] | [string],
  'basic_entity' : BasicEntity,
  'personas' : Array<PersonaResponse>,
  'wallet' : WalletVariant,
  'principal_id' : string,
  'phone_number' : [] | [string],
}
export interface AccountResponse {
  'name' : [] | [string],
  'anchor' : bigint,
  'access_points' : Array<AccessPointResponse>,
  'email' : [] | [string],
  'personas' : Array<PersonaResponse>,
  'is2fa_enabled' : boolean,
  'wallet' : WalletVariant,
  'principal_id' : string,
  'phone_number' : [] | [string],
}
export interface Application {
  'img' : [] | [string],
  'alias' : [] | [Array<string>],
  'user_limit' : number,
  'domain' : string,
  'name' : string,
  'is_nft_storage' : [] | [boolean],
  'is_trusted' : [] | [boolean],
  'is_iframe_allowed' : [] | [boolean],
}
export interface BasicEntity {
  'modified_date' : bigint,
  'created_date' : bigint,
}
export interface BoolHttpResponse {
  'data' : [] | [boolean],
  'error' : [] | [Error],
  'status_code' : number,
}
export type CanisterCyclesAggregatedData = BigUint64Array | bigint[];
export type CanisterHeapMemoryAggregatedData = BigUint64Array | bigint[];
export type CanisterLogFeature = { 'filterMessageByContains' : null } |
  { 'filterMessageByRegex' : null };
export interface CanisterLogMessages {
  'data' : Array<LogMessagesData>,
  'lastAnalyzedMessageTimeNanos' : [] | [Nanos],
}
export interface CanisterLogMessagesInfo {
  'features' : Array<[] | [CanisterLogFeature]>,
  'lastTimeNanos' : [] | [Nanos],
  'count' : number,
  'firstTimeNanos' : [] | [Nanos],
}
export type CanisterLogRequest = { 'getMessagesInfo' : null } |
  { 'getMessages' : GetLogMessagesParameters } |
  { 'getLatestMessages' : GetLatestLogMessagesParameters };
export type CanisterLogResponse = { 'messagesInfo' : CanisterLogMessagesInfo } |
  { 'messages' : CanisterLogMessages };
export type CanisterMemoryAggregatedData = BigUint64Array | bigint[];
export interface CanisterMetrics { 'data' : CanisterMetricsData }
export type CanisterMetricsData = { 'hourly' : Array<HourlyMetricsData> } |
  { 'daily' : Array<DailyMetricsData> };
export interface CertifiedResponse {
  'certificate' : Uint8Array | number[],
  'witness' : Uint8Array | number[],
  'response' : string,
}
export interface ConfigurationRequest {
  'env' : [] | [string],
  'whitelisted_phone_numbers' : [] | [Array<string>],
  'backup_canister_id' : [] | [string],
  'ii_canister_id' : [] | [Principal],
  'whitelisted_canisters' : [] | [Array<Principal>],
  'operator' : [] | [Principal],
  'git_branch' : [] | [string],
  'lambda' : [] | [Principal],
  'lambda_url' : [] | [string],
  'token_refresh_ttl' : [] | [bigint],
  'account_creation_paused' : [] | [boolean],
  'heartbeat' : [] | [number],
  'token_ttl' : [] | [bigint],
  'commit_hash' : [] | [string],
}
export interface ConfigurationResponse {
  'env' : [] | [string],
  'whitelisted_phone_numbers' : [] | [Array<string>],
  'backup_canister_id' : [] | [string],
  'ii_canister_id' : [] | [Principal],
  'whitelisted_canisters' : [] | [Array<Principal>],
  'operator' : [] | [Principal],
  'git_branch' : [] | [string],
  'lambda' : [] | [Principal],
  'lambda_url' : [] | [string],
  'token_refresh_ttl' : [] | [bigint],
  'account_creation_paused' : [] | [boolean],
  'heartbeat' : [] | [number],
  'token_ttl' : [] | [bigint],
  'commit_hash' : [] | [string],
}
export interface DailyMetricsData {
  'updateCalls' : bigint,
  'canisterHeapMemorySize' : NumericEntity,
  'canisterCycles' : NumericEntity,
  'canisterMemorySize' : NumericEntity,
  'timeMillis' : bigint,
}
export type DeviceType = { 'Email' : null } |
  { 'Password' : null } |
  { 'Passkey' : null } |
  { 'Recovery' : null } |
  { 'Unknown' : null };
export type Error = string;
export interface GetLatestLogMessagesParameters {
  'upToTimeNanos' : [] | [Nanos],
  'count' : number,
  'filter' : [] | [GetLogMessagesFilter],
}
export interface GetLogMessagesFilter {
  'analyzeCount' : number,
  'messageRegex' : [] | [string],
  'messageContains' : [] | [string],
}
export interface GetLogMessagesParameters {
  'count' : number,
  'filter' : [] | [GetLogMessagesFilter],
  'fromTimeNanos' : [] | [Nanos],
}
export interface GetMetricsParameters {
  'dateToMillis' : bigint,
  'granularity' : MetricsGranularity,
  'dateFromMillis' : bigint,
}
export interface HTTPAccessPointResponse {
  'data' : [] | [Array<AccessPointResponse>],
  'error' : [] | [Error],
  'status_code' : number,
}
export interface HTTPAccountRequest {
  'anchor' : bigint,
  'email' : [] | [string],
  'access_point' : [] | [AccessPointRequest],
  'wallet' : [] | [WalletVariant],
}
export interface HTTPAccountResponse {
  'data' : [] | [AccountResponse],
  'error' : [] | [Error],
  'status_code' : number,
}
export interface HTTPAccountUpdateRequest {
  'name' : [] | [string],
  'email' : [] | [string],
}
export interface HTTPAnchorsResponse {
  'data' : [] | [BigUint64Array | bigint[]],
  'error' : [] | [Error],
  'status_code' : number,
}
export interface HTTPAppResponse {
  'data' : [] | [Application],
  'error' : [] | [Error],
  'status_code' : number,
}
export interface HTTPApplicationResponse {
  'data' : [] | [Array<Application>],
  'error' : [] | [Error],
  'status_code' : number,
}
export interface HTTPOneAccessPointResponse {
  'data' : [] | [AccessPointResponse],
  'error' : [] | [Error],
  'status_code' : number,
}
export interface HTTPPersonasResponse {
  'data' : [] | [Array<PersonaResponse>],
  'error' : [] | [Error],
  'status_code' : number,
}
export interface HourlyMetricsData {
  'updateCalls' : UpdateCallsAggregatedData,
  'canisterHeapMemorySize' : CanisterHeapMemoryAggregatedData,
  'canisterCycles' : CanisterCyclesAggregatedData,
  'canisterMemorySize' : CanisterMemoryAggregatedData,
  'timeMillis' : bigint,
}
export interface LogMessagesData { 'timeNanos' : Nanos, 'message' : string }
export type MetricsGranularity = { 'hourly' : null } |
  { 'daily' : null };
export type Nanos = bigint;
export interface NumericEntity {
  'avg' : bigint,
  'max' : bigint,
  'min' : bigint,
  'first' : bigint,
  'last' : bigint,
}
export interface PersonaRequest {
  'domain' : string,
  'persona_name' : string,
  'persona_id' : string,
}
export interface PersonaResponse {
  'domain' : string,
  'persona_name' : string,
  'persona_id' : string,
}
export interface PrincipalEmailRequest {
  'email' : string,
  'principal_id' : string,
}
export interface Response { 'error' : [] | [Error], 'status_code' : number }
export interface StringHttpResponse {
  'data' : [] | [string],
  'error' : [] | [Error],
  'status_code' : number,
}
export type UpdateCallsAggregatedData = BigUint64Array | bigint[];
export type WalletVariant = { 'II' : null } |
  { 'NFID' : null };
export interface _SERVICE {
  'add_email_and_principal_for_create_account_validation' : ActorMethod<
    [string, string, bigint],
    BoolHttpResponse
  >,
  'configure' : ActorMethod<[ConfigurationRequest], undefined>,
  'count_anchors' : ActorMethod<[], bigint>,
  'create_access_point' : ActorMethod<
    [AccessPointRequest],
    HTTPAccessPointResponse
  >,
  'create_account' : ActorMethod<[HTTPAccountRequest], HTTPAccountResponse>,
  'get_account' : ActorMethod<[], HTTPAccountResponse>,
  'get_account_by_anchor' : ActorMethod<[bigint], HTTPAccountResponse>,
  'get_account_by_principal' : ActorMethod<[string], HTTPAccountResponse>,
  'get_all_accounts_json' : ActorMethod<[number, number], string>,
  'get_config' : ActorMethod<[], ConfigurationResponse>,
  'get_remaining_size_after_rebuild_device_index_slice_from_temp_stack' : ActorMethod<
    [[] | [bigint]],
    bigint
  >,
  'get_root_certified' : ActorMethod<[], CertifiedResponse>,
  'pause_account_creation' : ActorMethod<[boolean], undefined>,
  'read_access_points' : ActorMethod<[], HTTPAccessPointResponse>,
  'read_applications' : ActorMethod<[], HTTPApplicationResponse>,
  'read_personas' : ActorMethod<[], HTTPPersonasResponse>,
  'remove_access_point' : ActorMethod<
    [AccessPointRemoveRequest],
    HTTPAccessPointResponse
  >,
  'remove_account' : ActorMethod<[], BoolHttpResponse>,
  'remove_account_by_principal' : ActorMethod<[string], BoolHttpResponse>,
  'restore_accounts' : ActorMethod<[string], BoolHttpResponse>,
  'save_temp_stack_to_rebuild_device_index' : ActorMethod<[], string>,
  'store_accounts' : ActorMethod<[Array<Account>], BoolHttpResponse>,
  'sync_controllers' : ActorMethod<[], Array<string>>,
  'sync_recovery_phrase_from_internet_identity' : ActorMethod<
    [bigint],
    HTTPAccountResponse
  >,
  'update_2fa' : ActorMethod<[boolean], AccountResponse>,
  'update_access_point' : ActorMethod<
    [AccessPointRequest],
    HTTPAccessPointResponse
  >,
  'update_account' : ActorMethod<
    [HTTPAccountUpdateRequest],
    HTTPAccountResponse
  >,
  'use_access_point' : ActorMethod<[[] | [string]], HTTPOneAccessPointResponse>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
