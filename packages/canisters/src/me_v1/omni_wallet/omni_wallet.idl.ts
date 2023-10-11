export const idlFactory = ({ IDL }) => {
  const ExpiryUser = IDL.Record({
    'user' : IDL.Principal,
    'expiry_timestamp' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
  });
  const ManagerPayload = IDL.Record({
    'principal' : IDL.Principal,
    'name' : IDL.Text,
  });
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const AppInfo = IDL.Record({
    'app_id' : IDL.Text,
    'current_version' : Version,
    'latest_version' : Version,
    'wallet_id' : IDL.Opt(IDL.Principal),
  });
  const Result = IDL.Variant({ 'Ok' : AppInfo, 'Err' : IDL.Text });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : IDL.Text });
  const Result_3 = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Vec(IDL.Nat8)),
    'Err' : IDL.Text,
  });
  const ECDSAPublicKeyPayload = IDL.Record({
    'public_key_uncompressed' : IDL.Vec(IDL.Nat8),
    'public_key' : IDL.Vec(IDL.Nat8),
    'chain_code' : IDL.Vec(IDL.Nat8),
  });
  const Result_4 = IDL.Variant({
    'Ok' : ECDSAPublicKeyPayload,
    'Err' : IDL.Text,
  });
  const GAVerifyRequest = IDL.Record({ 'code' : IDL.Text });
  const SignatureReply = IDL.Record({ 'signature' : IDL.Vec(IDL.Nat8) });
  const Result_5 = IDL.Variant({ 'Ok' : SignatureReply, 'Err' : IDL.Text });
  const Result_6 = IDL.Variant({ 'Ok' : IDL.Vec(IDL.Text), 'Err' : IDL.Text });
  const AccountDetail = IDL.Record({
    'principal' : IDL.Principal,
    'active' : IDL.Bool,
    'sub_account' : IDL.Vec(IDL.Nat8),
    'account_identifier' : IDL.Text,
    'wallet_name' : IDL.Text,
  });
  const AccountBalanceArgs = IDL.Record({ 'account' : IDL.Vec(IDL.Nat8) });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const SendArgs = IDL.Record({
    'account_id' : IDL.Vec(IDL.Nat8),
    'memo' : IDL.Opt(IDL.Nat64),
    'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'amount' : Tokens,
  });
  const Result_7 = IDL.Variant({ 'Ok' : IDL.Nat64, 'Err' : IDL.Text });
  const TransferArgs = IDL.Record({
    'memo' : IDL.Opt(IDL.Nat64),
    'sub_account_to' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'principal_to' : IDL.Principal,
    'amount' : Tokens,
  });
  const CallCanisterArgs = IDL.Record({
    'args' : IDL.Vec(IDL.Nat8),
    'cycles' : IDL.Nat,
    'method_name' : IDL.Text,
    'canister' : IDL.Principal,
  });
  const CallResult = IDL.Record({ 'return' : IDL.Vec(IDL.Nat8) });
  const Result_8 = IDL.Variant({ 'Ok' : CallResult, 'Err' : IDL.Text });
  return IDL.Service({
    'addExpiryUser' : IDL.Func([IDL.Principal], [ExpiryUser], []),
    'addManager' : IDL.Func([ManagerPayload], [], []),
    'app_info_get' : IDL.Func([], [Result], ['query']),
    'app_info_update' : IDL.Func(
        [IDL.Principal, IDL.Text, Version],
        [Result_1],
        [],
      ),
    'app_version_check' : IDL.Func([], [Result], []),
    'balance_get' : IDL.Func([], [Result_2], ['query']),
    'cycleBalance' : IDL.Func([], [IDL.Nat], []),
    'ecGetDeriveBytes' : IDL.Func([IDL.Text], [Result_3], ['query']),
    'ecGetPublicKey' : IDL.Func([IDL.Text, IDL.Opt(IDL.Text)], [Result_4], []),
    'ecSign' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Nat8), IDL.Opt(GAVerifyRequest)],
        [Result_5],
        [],
      ),
    'ecSignRecoverable' : IDL.Func(
        [
          IDL.Text,
          IDL.Vec(IDL.Nat8),
          IDL.Opt(IDL.Nat32),
          IDL.Opt(GAVerifyRequest),
        ],
        [Result_5],
        [],
      ),
    'ego_canister_add' : IDL.Func([IDL.Text, IDL.Principal], [Result_1], []),
    'ego_canister_upgrade' : IDL.Func([], [Result_1], []),
    'ego_controller_add' : IDL.Func([IDL.Principal], [Result_1], []),
    'ego_controller_remove' : IDL.Func([IDL.Principal], [Result_1], []),
    'ego_controller_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result_1], []),
    'ego_log_list' : IDL.Func([IDL.Nat64], [Result_6], ['query']),
    'ego_op_add' : IDL.Func([IDL.Principal], [Result_1], []),
    'ego_owner_add' : IDL.Func([IDL.Principal], [Result_1], []),
    'ego_owner_remove' : IDL.Func([IDL.Principal], [Result_1], []),
    'ego_owner_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result_1], []),
    'ego_user_add' : IDL.Func([IDL.Principal], [Result_1], []),
    'ego_user_remove' : IDL.Func([IDL.Principal], [Result_1], []),
    'ego_user_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result_1], []),
    'icpAddAccount' : IDL.Func([AccountDetail], [], []),
    'icpGetAccounts' : IDL.Func([], [IDL.Vec(AccountDetail)], ['query']),
    'icpGetAddress' : IDL.Func([IDL.Opt(IDL.Vec(IDL.Nat8))], [IDL.Text], []),
    'icpGetBalance' : IDL.Func([IDL.Opt(AccountBalanceArgs)], [Tokens], []),
    'icpListSubaccount' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'icpSend' : IDL.Func([SendArgs, IDL.Opt(GAVerifyRequest)], [Result_7], []),
    'icpTransfer' : IDL.Func(
        [TransferArgs, IDL.Opt(GAVerifyRequest)],
        [Result_7],
        [],
      ),
    'icpUpdateAccount' : IDL.Func([AccountDetail], [IDL.Bool], []),
    'isManager' : IDL.Func([], [IDL.Bool], ['query']),
    'listManager' : IDL.Func([], [IDL.Vec(ManagerPayload)], ['query']),
    'proxyCall' : IDL.Func([CallCanisterArgs], [Result_8], []),
    'removeManager' : IDL.Func([IDL.Principal], [], []),
    'setExpiryPeriod' : IDL.Func([IDL.Nat64], [], []),
    'setLocalGA' : IDL.Func([IDL.Bool], [IDL.Bool], []),
  });
};
export const init = ({ IDL }) => { return []; };
