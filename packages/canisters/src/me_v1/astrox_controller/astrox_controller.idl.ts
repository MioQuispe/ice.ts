export const idlFactory = ({ IDL }) => {
  const Version = IDL.Record({
    major: IDL.Nat32,
    minor: IDL.Nat32,
    patch: IDL.Nat32,
  });
  const AppInfo = IDL.Record({
    app_id: IDL.Text,
    current_version: Version,
    latest_version: Version,
    wallet_id: IDL.Opt(IDL.Principal),
  });
  const Result = IDL.Variant({ Ok: AppInfo, Err: IDL.Text });
  const Result_1 = IDL.Variant({ Ok: IDL.Null, Err: IDL.Text });
  const Category = IDL.Variant({ System: IDL.Null, Vault: IDL.Null });
  const App = IDL.Record({
    logo: IDL.Text,
    name: IDL.Text,
    description: IDL.Text,
    app_id: IDL.Text,
    category: Category,
    current_version: Version,
    price: IDL.Float32,
  });
  const WalletError = IDL.Record({ msg: IDL.Text, code: IDL.Nat16 });
  const Result_2 = IDL.Variant({ Ok: IDL.Vec(App), Err: WalletError });
  const Result_3 = IDL.Variant({ Ok: IDL.Nat, Err: IDL.Text });
  const Result_4 = IDL.Variant({ Ok: IDL.Vec(IDL.Text), Err: IDL.Text });
  const GAVerifyRequest = IDL.Record({ code: IDL.Text });
  const GAError = IDL.Variant({ Error: IDL.Text });
  const Result_5 = IDL.Variant({ Ok: IDL.Text, Err: GAError });
  const AppInstallRequest = IDL.Record({ app_id: IDL.Text });
  const Result_6 = IDL.Variant({ Ok: IDL.Null, Err: WalletError });
  const CanisterType = IDL.Variant({
    BACKEND: IDL.Null,
    ASSET: IDL.Null,
  });
  const Canister = IDL.Record({
    canister_id: IDL.Principal,
    canister_type: CanisterType,
  });
  const UserApp = IDL.Record({
    app: App,
    canister: Canister,
    latest_version: Version,
  });
  const Result_7 = IDL.Variant({
    Ok: IDL.Vec(UserApp),
    Err: WalletError,
  });
  return IDL.Service({
    app_info_get: IDL.Func([], [Result], ['query']),
    app_info_update: IDL.Func([IDL.Principal, IDL.Text, Version], [Result_1], []),
    app_main_list: IDL.Func([], [Result_2], []),
    app_version_check: IDL.Func([], [Result], []),
    balance_get: IDL.Func([], [Result_3], ['query']),
    ego_canister_add: IDL.Func([IDL.Text, IDL.Principal], [Result_1], []),
    ego_canister_upgrade: IDL.Func([], [Result_1], []),
    ego_controller_add: IDL.Func([IDL.Principal], [Result_1], []),
    ego_controller_remove: IDL.Func([IDL.Principal], [Result_1], []),
    ego_controller_set: IDL.Func([IDL.Vec(IDL.Principal)], [Result_1], []),
    ego_log_list: IDL.Func([IDL.Nat64], [Result_4], ['query']),
    ego_op_add: IDL.Func([IDL.Principal], [Result_1], []),
    ego_owner_add: IDL.Func([IDL.Principal], [Result_1], []),
    ego_owner_remove: IDL.Func([IDL.Principal], [Result_1], []),
    ego_owner_set: IDL.Func([IDL.Vec(IDL.Principal)], [Result_1], []),
    ego_user_add: IDL.Func([IDL.Principal], [Result_1], []),
    ego_user_remove: IDL.Func([IDL.Principal], [Result_1], []),
    ego_user_set: IDL.Func([IDL.Vec(IDL.Principal)], [Result_1], []),
    ga_enabled: IDL.Func([], [IDL.Bool], []),
    ga_guard: IDL.Func([IDL.Opt(GAVerifyRequest)], [IDL.Bool], []),
    ga_reset: IDL.Func([], [Result_5], []),
    ga_secret: IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
    ga_set_enabled: IDL.Func([IDL.Bool, IDL.Opt(IDL.Principal)], [], []),
    ga_url: IDL.Func([], [IDL.Text], ['query']),
    ga_verify: IDL.Func([GAVerifyRequest], [IDL.Bool], []),
    install_app: IDL.Func([AppInstallRequest], [Result_6], []),
    uninstall_app: IDL.Func([IDL.Principal], [Result_6], []),
    upgrade_app: IDL.Func([IDL.Principal], [Result_6], []),
    wallet_app_list: IDL.Func([], [Result_7], []),
  });
};
export const init = ({ IDL }) => {
  return [];
};
