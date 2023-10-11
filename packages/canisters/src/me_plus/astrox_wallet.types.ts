import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface App {
  logo: string;
  name: string;
  description: string;
  app_id: string;
  category: Category;
  current_version: Version;
  price: number;
}
export interface AppInstallRequest {
  app_id: string;
}
export interface AppMainListRequest {
  query_param: QueryParam;
}
export interface AppMainListResponse {
  apps: Array<App>;
}
export interface Canister {
  canister_id: Principal;
  canister_type: CanisterType;
}
export type CanisterType = { BACKEND: null } | { ASSET: null };
export type Category = { System: null } | { Vault: null };
export interface InitWalletCanister {
  store_canister_id: Principal;
}
export type QueryParam = { ByCategory: { category: Category } };
export interface RechargeRequest {
  amount: number;
}
export interface RechargeResponse {
  memo: bigint;
}
export type Result = { Ok: AppMainListResponse } | { Err: WalletError };
export type Result_1 = { Ok: null } | { Err: WalletError };
export type Result_2 = { Ok: UserAppResponse } | { Err: WalletError };
export type Result_3 = { Ok: RechargeResponse } | { Err: WalletError };
export interface UserApp {
  version: Version;
  app_id: string;
  canisters: Array<Canister>;
}
export interface UserAppResponse {
  apps: Array<UserApp>;
}
export interface Version {
  major: number;
  minor: number;
  patch: number;
}
export interface WalletError {
  msg: string;
  code: number;
}
export interface _SERVICE {
  app_list: ActorMethod<[AppMainListRequest], Result>;
  init_wallet_canister: ActorMethod<[InitWalletCanister], Result_1>;
  install_app: ActorMethod<[AppInstallRequest], Result_1>;
  installed_apps: ActorMethod<[], Result_2>;
  recharge: ActorMethod<[RechargeRequest], Result_3>;
  uninstall_app: ActorMethod<[AppInstallRequest], Result_1>;
  upgrade_app: ActorMethod<[AppInstallRequest], Result_1>;
}
