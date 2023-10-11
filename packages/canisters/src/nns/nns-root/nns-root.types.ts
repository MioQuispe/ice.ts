import type { Principal } from '@dfinity/principal';
export interface CanisterIdRecord { 'canister_id' : Principal }
export interface CanisterStatusResult {
  'status' : CanisterStatusType,
  'memory_size' : bigint,
  'cycles' : bigint,
  'settings' : DefiniteCanisterSettings,
  'module_hash' : [] | [Array<number>],
}
export type CanisterStatusType = { 'stopped' : null } |
  { 'stopping' : null } |
  { 'running' : null };
export interface ChangeCanisterControllersError {
  'code' : [] | [number],
  'description' : string,
}
export interface ChangeCanisterControllersRequest {
  'target_canister_id' : Principal,
  'new_controllers' : Array<Principal>,
}
export interface ChangeCanisterControllersResponse {
  'change_canister_controllers_result' : ChangeCanisterControllersResult,
}
export type ChangeCanisterControllersResult = { 'Ok' : null } |
  { 'Err' : ChangeCanisterControllersError };
export interface DefiniteCanisterSettings { 'controllers' : Array<Principal> }
export interface _SERVICE {
  'canister_status' : (arg_0: CanisterIdRecord) => Promise<
      CanisterStatusResult
    >,
  'change_canister_controllers' : (
      arg_0: ChangeCanisterControllersRequest,
    ) => Promise<ChangeCanisterControllersResponse>,
  'get_build_metadata' : () => Promise<string>,
}
