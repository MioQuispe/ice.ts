export const idlFactory = ({ IDL }) => {
  const Category = IDL.Variant({ 'System' : IDL.Null, 'Vault' : IDL.Null });
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const App = IDL.Record({
    'logo' : IDL.Text,
    'name' : IDL.Text,
    'description' : IDL.Text,
    'app_id' : IDL.Text,
    'app_hash' : IDL.Text,
    'category' : Category,
    'current_version' : Version,
    'price' : IDL.Float32,
  });
  const WalletError = IDL.Record({ 'msg' : IDL.Text, 'code' : IDL.Nat16 });
  const Result = IDL.Variant({ 'Ok' : IDL.Vec(App), 'Err' : WalletError });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : IDL.Text });
  const AppInfo = IDL.Record({
    'app_id' : IDL.Text,
    'current_version' : Version,
    'latest_version' : Version,
    'wallet_id' : IDL.Opt(IDL.Principal),
  });
  const Result_2 = IDL.Variant({ 'Ok' : AppInfo, 'Err' : IDL.Text });
  const Result_3 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const CycleRecord = IDL.Record({ 'ts' : IDL.Nat64, 'balance' : IDL.Nat });
  const Result_4 = IDL.Variant({
    'Ok' : IDL.Vec(CycleRecord),
    'Err' : IDL.Text,
  });
  const CycleInfo = IDL.Record({
    'records' : IDL.Vec(CycleRecord),
    'estimate_remaining' : IDL.Nat64,
  });
  const Result_5 = IDL.Variant({ 'Ok' : CycleInfo, 'Err' : IDL.Text });
  const Result_6 = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : IDL.Text });
  const Result_7 = IDL.Variant({ 'Ok' : IDL.Vec(IDL.Text), 'Err' : IDL.Text });
  const GAVerifyRequest = IDL.Record({ 'code' : IDL.Text });
  const GAError = IDL.Variant({ 'Error' : IDL.Text });
  const Result_8 = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : GAError });
  const AppInstallRequest = IDL.Record({ 'app_id' : IDL.Text });
  const Result_9 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : WalletError });
  const CanisterType = IDL.Variant({
    'BACKEND' : IDL.Null,
    'ASSET' : IDL.Null,
  });
  const Canister = IDL.Record({
    'canister_id' : IDL.Principal,
    'canister_type' : CanisterType,
  });
  const UserApp = IDL.Record({
    'app' : App,
    'canister' : Canister,
    'latest_version' : Version,
  });
  const Result_10 = IDL.Variant({
    'Ok' : IDL.Vec(UserApp),
    'Err' : WalletError,
  });
  const Result_11 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : WalletError });
  const CashFlowType = IDL.Variant({
    'CHARGE' : IDL.Null,
    'RECHARGE' : IDL.Null,
  });
  const CashFlow = IDL.Record({
    'balance' : IDL.Nat,
    'operator' : IDL.Principal,
    'created_at' : IDL.Nat64,
    'comment' : IDL.Text,
    'cycles' : IDL.Nat,
    'cash_flow_type' : CashFlowType,
  });
  const Result_12 = IDL.Variant({
    'Ok' : IDL.Vec(CashFlow),
    'Err' : WalletError,
  });
  return IDL.Service({
    'app_main_list' : IDL.Func([], [Result], []),
    'balance_get' : IDL.Func([], [Result_1], ['query']),
    'ego_app_info_get' : IDL.Func([], [Result_2], ['query']),
    'ego_app_info_update' : IDL.Func(
        [IDL.Opt(IDL.Principal), IDL.Text, Version],
        [Result_3],
        [],
      ),
    'ego_app_version_check' : IDL.Func([], [Result_2], []),
    'ego_canister_add' : IDL.Func([IDL.Text, IDL.Principal], [Result_3], []),
    'ego_canister_remove' : IDL.Func([], [Result_3], []),
    'ego_canister_upgrade' : IDL.Func([], [Result_3], []),
    'ego_controller_add' : IDL.Func([IDL.Principal], [Result_3], []),
    'ego_controller_remove' : IDL.Func([IDL.Principal], [Result_3], []),
    'ego_controller_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result_3], []),
    'ego_cycle_check' : IDL.Func([], [Result_3], []),
    'ego_cycle_estimate_set' : IDL.Func([IDL.Nat64], [Result_3], []),
    'ego_cycle_history' : IDL.Func([], [Result_4], ['query']),
    'ego_cycle_info' : IDL.Func([], [Result_5], []),
    'ego_cycle_recharge' : IDL.Func([IDL.Nat], [Result_3], []),
    'ego_cycle_threshold_get' : IDL.Func([], [Result_1], []),
    'ego_is_owner' : IDL.Func([], [Result_6], ['query']),
    'ego_is_user' : IDL.Func([], [Result_6], ['query']),
    'ego_log_list' : IDL.Func([IDL.Nat64], [Result_7], ['query']),
    'ego_op_add' : IDL.Func([IDL.Principal], [Result_3], []),
    'ego_owner_add' : IDL.Func([IDL.Principal], [Result_3], []),
    'ego_owner_add_with_name' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result_3],
        [],
      ),
    'ego_owner_remove' : IDL.Func([IDL.Principal], [Result_3], []),
    'ego_owner_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result_3], []),
    'ego_runtime_cycle_threshold_get' : IDL.Func([], [Result_1], []),
    'ego_user_add' : IDL.Func([IDL.Principal], [Result_3], []),
    'ego_user_remove' : IDL.Func([IDL.Principal], [Result_3], []),
    'ego_user_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result_3], []),
    'ga_enabled' : IDL.Func([], [IDL.Bool], []),
    'ga_guard' : IDL.Func([IDL.Opt(GAVerifyRequest)], [IDL.Bool], []),
    'ga_reset' : IDL.Func([], [Result_8], []),
    'ga_secret' : IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
    'ga_set_enabled' : IDL.Func([IDL.Bool, IDL.Opt(IDL.Principal)], [], []),
    'ga_url' : IDL.Func([], [IDL.Text], ['query']),
    'ga_verify' : IDL.Func([GAVerifyRequest], [IDL.Bool], []),
    'install_app' : IDL.Func([AppInstallRequest], [Result_9], []),
    'remove_app' : IDL.Func([IDL.Principal], [Result_9], []),
    'upgrade_app' : IDL.Func([IDL.Principal], [Result_9], []),
    'wallet_app_list' : IDL.Func([], [Result_10], []),
    'wallet_cycle_balance' : IDL.Func([], [Result_11], []),
    'wallet_cycle_list' : IDL.Func([], [Result_12], []),
  });
};
export const init = ({ IDL }) => { return []; };
