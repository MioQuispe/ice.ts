import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type Category = { 'Sns' : null } |
  { 'Spam' : null } |
  { 'Native' : null } |
  { 'Known' : null } |
  { 'ChainFusionTestnet' : null } |
  { 'ChainFusion' : null } |
  { 'Community' : null };
export interface Conf {
  'controllers' : [] | [Array<Principal>],
  'im_canister' : [] | [Principal],
}
export interface ICRC1 {
  'fee' : bigint,
  'root_canister_id' : [] | [string],
  'decimals' : number,
  'logo' : [] | [string],
  'name' : string,
  'date_added' : bigint,
  'ledger' : string,
  'category' : Category,
  'index' : [] | [string],
  'symbol' : string,
}
export interface ICRC1Request {
  'fee' : bigint,
  'decimals' : number,
  'logo' : [] | [string],
  'name' : string,
  'ledger' : string,
  'index' : [] | [string],
  'symbol' : string,
}
export interface _SERVICE {
  'count_icrc1_canisters' : ActorMethod<[], bigint>,
  'get_all_icrc1_canisters' : ActorMethod<[], Array<ICRC1>>,
  'get_icrc1_paginated' : ActorMethod<[bigint, bigint], Array<ICRC1>>,
  'remove_icrc1_canister' : ActorMethod<[string], undefined>,
  'replace_icrc1_canisters' : ActorMethod<[Array<ICRC1>], undefined>,
  'set_operator' : ActorMethod<[Principal], undefined>,
  'store_icrc1_canister' : ActorMethod<[ICRC1Request], undefined>,
  'store_new_icrc1_canisters' : ActorMethod<[Array<ICRC1>], undefined>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
