export const idlFactory = ({ IDL }) => {
  const Category = IDL.Variant({ System: IDL.Null, Vault: IDL.Null });
  const QueryParam = IDL.Variant({
    ByCategory: IDL.Record({ category: Category }),
  });
  const AppMainListRequest = IDL.Record({ query_param: QueryParam });
  const Version = IDL.Record({
    major: IDL.Nat32,
    minor: IDL.Nat32,
    patch: IDL.Nat32,
  });
  const App = IDL.Record({
    logo: IDL.Text,
    name: IDL.Text,
    description: IDL.Text,
    app_id: IDL.Text,
    category: Category,
    current_version: Version,
    price: IDL.Float32,
  });
  const AppMainListResponse = IDL.Record({ apps: IDL.Vec(App) });
  const WalletError = IDL.Record({ msg: IDL.Text, code: IDL.Nat16 });
  const Result = IDL.Variant({
    Ok: AppMainListResponse,
    Err: WalletError,
  });
  const InitWalletCanister = IDL.Record({
    store_canister_id: IDL.Principal,
  });
  const Result_1 = IDL.Variant({ Ok: IDL.Null, Err: WalletError });
  const AppInstallRequest = IDL.Record({ app_id: IDL.Text });
  const CanisterType = IDL.Variant({
    BACKEND: IDL.Null,
    ASSET: IDL.Null,
  });
  const Canister = IDL.Record({
    canister_id: IDL.Principal,
    canister_type: CanisterType,
  });
  const UserApp = IDL.Record({
    version: Version,
    app_id: IDL.Text,
    canisters: IDL.Vec(Canister),
  });
  const UserAppResponse = IDL.Record({ apps: IDL.Vec(UserApp) });
  const Result_2 = IDL.Variant({ Ok: UserAppResponse, Err: WalletError });
  const RechargeRequest = IDL.Record({ amount: IDL.Float32 });
  const RechargeResponse = IDL.Record({ memo: IDL.Nat64 });
  const Result_3 = IDL.Variant({
    Ok: RechargeResponse,
    Err: WalletError,
  });
  return IDL.Service({
    app_list: IDL.Func([AppMainListRequest], [Result], ['query']),
    init_wallet_canister: IDL.Func([InitWalletCanister], [Result_1], []),
    install_app: IDL.Func([AppInstallRequest], [Result_1], []),
    installed_apps: IDL.Func([], [Result_2], ['query']),
    recharge: IDL.Func([RechargeRequest], [Result_3], []),
    uninstall_app: IDL.Func([AppInstallRequest], [Result_1], []),
    upgrade_app: IDL.Func([AppInstallRequest], [Result_1], []),
  });
};
export const init = ({ IDL }) => {
  return [];
};
