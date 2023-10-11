export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const AppType = IDL.Variant({
    'android_app' : IDL.Null,
    'mobile_extension' : IDL.Null,
    'mobile_browser' : IDL.Null,
    'desktop_extension' : IDL.Null,
    'desktop_browser' : IDL.Null,
    'desktop_app' : IDL.Null,
    'ios_app' : IDL.Null,
  });
  const DeviceType = IDL.Variant({
    'IdentityProvider' : IDL.Null,
    'RecoveryPhrase' : IDL.Null,
    'SecurityDevice' : IDL.Null,
    'Google' : IDL.Null,
    'EthereumMetaMask' : IDL.Null,
  });
  const Purpose = IDL.Variant({
    'authentication' : IDL.Null,
    'recovery' : IDL.Null,
    'management' : IDL.Null,
  });
  const DeviceDataExternal = IDL.Record({
    'os_type' : IDL.Opt(AppType),
    'device_name' : IDL.Text,
    'device_type' : DeviceType,
    'pub_key' : IDL.Vec(IDL.Nat8),
    'enable_e2e' : IDL.Opt(IDL.Bool),
    'purpose' : Purpose,
    'credential_id' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'resolver_id' : IDL.Opt(IDL.Text),
  });
  const RegistrationState = IDL.Variant({
    'DeviceRegistrationModeActive' : IDL.Null,
    'DeviceTentativelyAdded' : IDL.Record({
      'failed_attempts' : IDL.Nat8,
      'tentative_device' : DeviceDataExternal,
      'verification_code' : IDL.Text,
      'tentative_principal' : IDL.Principal,
    }),
  });
  const TentativeDeviceRegistration = IDL.Record({
    'state' : RegistrationState,
    'expiration' : IDL.Nat64,
  });
  const MEUser = IDL.Record({
    'user_number' : IDL.Nat64,
    'user_name' : IDL.Text,
    'ego_controller' : IDL.Opt(IDL.Principal),
    'e2e_id' : IDL.Opt(IDL.Nat64),
    'user_id' : IDL.Opt(IDL.Text),
    'tentative' : IDL.Opt(TentativeDeviceRegistration),
    'devices' : IDL.Vec(DeviceDataExternal),
    'last_update' : IDL.Nat64,
  });
  const BackupStatus = IDL.Variant({
    'MAINTAINING' : IDL.Null,
    'RUNNING' : IDL.Null,
  });
  const BackupInfo = IDL.Record({
    'state' : BackupStatus,
    'last_backup' : IDL.Nat64,
    'recent_backup' : IDL.Opt(IDL.Nat64),
  });
  const Result_1 = IDL.Variant({ 'Ok' : BackupInfo, 'Err' : IDL.Text });
  const BackupJob = IDL.Record({ 'name' : IDL.Text, 'amount' : IDL.Nat64 });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Vec(BackupJob), 'Err' : IDL.Text });
  const Result_3 = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : IDL.Text });
  const InstallControllerResponse = IDL.Variant({
    'success' : IDL.Principal,
    'failed' : IDL.Null,
  });
  const EncDoc = IDL.Record({
    'data' : IDL.Vec(IDL.Nat8),
    'meta' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'manager_pub_key' : IDL.Vec(IDL.Nat8),
  });
  const E2EDeviceRequest = IDL.Record({
    'meta' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'enc_doc' : IDL.Opt(EncDoc),
    'pub_key' : IDL.Vec(IDL.Nat8),
  });
  const DeviceAddResponse = IDL.Variant({
    'added' : IDL.Record({ 'user_name' : IDL.Text, 'user_id' : IDL.Text }),
    'failed' : IDL.Null,
  });
  const MeError = IDL.Record({ 'msg' : IDL.Text, 'code' : IDL.Nat16 });
  const Result_4 = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : MeError });
  const DeviceDataExternalV1 = IDL.Record({
    'device_type' : DeviceType,
    'pub_key' : IDL.Vec(IDL.Nat8),
    'credential_id' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const DeviceRemoveResponse = IDL.Variant({
    'failed' : IDL.Null,
    'removed' : IDL.Null,
  });
  const DeviceUpdateResponse = IDL.Variant({
    'updated' : IDL.Null,
    'failed' : IDL.Null,
  });
  const Result_5 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : MeError });
  const AddTentativeDeviceResponse = IDL.Variant({
    'device_registration_mode_off' : IDL.Null,
    'another_device_tentatively_added' : IDL.Null,
    'added_tentatively' : IDL.Record({
      'verification_code' : IDL.Text,
      'device_registration_timeout' : IDL.Nat64,
    }),
  });
  const Result_6 = IDL.Variant({
    'Ok' : AddTentativeDeviceResponse,
    'Err' : IDL.Text,
  });
  const Result_7 = IDL.Variant({ 'Ok' : IDL.Nat64, 'Err' : IDL.Text });
  const Result_8 = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : IDL.Text });
  const VerifyTentativeMode = IDL.Variant({
    'active' : IDL.Null,
    'passive' : IDL.Null,
  });
  const VerifyTentativeDeviceResponse = IDL.Variant({
    'device_registration_mode_off' : IDL.Null,
    'verified' : IDL.Null,
    'wrong_code' : IDL.Record({ 'retries_left' : IDL.Nat8 }),
    'no_device_to_verify' : IDL.Null,
  });
  const Result_9 = IDL.Variant({
    'Ok' : VerifyTentativeDeviceResponse,
    'Err' : IDL.Text,
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
  const Result_10 = IDL.Variant({ 'Ok' : AppInfo, 'Err' : IDL.Text });
  const Result_11 = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
    'Err' : IDL.Text,
  });
  const CycleRecord = IDL.Record({ 'ts' : IDL.Nat64, 'balance' : IDL.Nat });
  const Result_12 = IDL.Variant({
    'Ok' : IDL.Vec(CycleRecord),
    'Err' : IDL.Text,
  });
  const CycleInfo = IDL.Record({
    'records' : IDL.Vec(CycleRecord),
    'estimate_remaining' : IDL.Nat64,
  });
  const Result_13 = IDL.Variant({ 'Ok' : CycleInfo, 'Err' : IDL.Text });
  const LogEntry = IDL.Record({
    'ts' : IDL.Nat64,
    'msg' : IDL.Text,
    'kind' : IDL.Text,
  });
  const Result_14 = IDL.Variant({ 'Ok' : IDL.Vec(LogEntry), 'Err' : IDL.Text });
  const Result_15 = IDL.Variant({
    'Ok' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Text))),
    'Err' : IDL.Text,
  });
  const DelegationMode = IDL.Variant({
    'domain' : IDL.Null,
    'global' : IDL.Null,
  });
  const Delegation = IDL.Record({
    'pubkey' : IDL.Vec(IDL.Nat8),
    'targets' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'expiration' : IDL.Nat64,
  });
  const SignedDelegation = IDL.Record({
    'signature' : IDL.Vec(IDL.Nat8),
    'delegation' : Delegation,
  });
  const GetDelegationResponse = IDL.Variant({
    'no_such_delegation' : IDL.Null,
    'signed_delegation' : SignedDelegation,
  });
  const PrepareDelegationResponse = IDL.Record({
    'user_key' : IDL.Vec(IDL.Nat8),
    'expiration' : IDL.Nat64,
  });
  const RegisterEvent = IDL.Record({
    'user_name' : IDL.Text,
    'device_name' : IDL.Text,
    'device_type' : DeviceType,
    'os_version' : IDL.Text,
    'os_name' : IDL.Text,
  });
  const RegisterResponse = IDL.Variant({
    'existed' : IDL.Record({ 'user_name' : IDL.Text }),
    'canister_full' : IDL.Null,
    'registered' : IDL.Record({ 'user_name' : IDL.Text, 'user_id' : IDL.Text }),
  });
  const BackupExportFormat = IDL.Variant({
    'JSON' : IDL.Null,
    'BINARY' : IDL.Null,
  });
  const ByteReadResponse = IDL.Record({
    'data' : IDL.Vec(IDL.Nat8),
    'hash' : IDL.Text,
    'name' : IDL.Text,
  });
  const Result_16 = IDL.Variant({
    'Ok' : IDL.Opt(ByteReadResponse),
    'Err' : IDL.Text,
  });
  const ByteWriteRequest = IDL.Record({
    'end' : IDL.Nat64,
    'data' : IDL.Vec(IDL.Nat8),
    'hash' : IDL.Text,
    'name' : IDL.Text,
    'start' : IDL.Nat64,
    'format' : IDL.Opt(BackupExportFormat),
  });
  const Result_17 = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : MeError });
  const HardwareWalletAccountDetails = IDL.Record({
    'principal' : IDL.Principal,
    'name' : IDL.Text,
    'account_identifier' : IDL.Text,
  });
  const SubAccountDetails = IDL.Record({
    'name' : IDL.Text,
    'payment_limit' : IDL.Opt(IDL.Nat64),
    'sub_account' : IDL.Vec(IDL.Nat8),
    'account_identifier' : IDL.Text,
  });
  const MEAccountDetails = IDL.Record({
    'principal' : IDL.Principal,
    'active' : IDL.Bool,
    'account_identifier' : IDL.Text,
    'hardware_wallet_accounts' : IDL.Vec(HardwareWalletAccountDetails),
    'wallet_name' : IDL.Text,
    'sub_accounts' : IDL.Vec(SubAccountDetails),
  });
  const UpdateMEWalletResponse = IDL.Variant({
    'success' : IDL.Null,
    'failed' : IDL.Null,
  });
  const NNSAccountDetails = IDL.Record({
    'principal' : IDL.Principal,
    'active' : IDL.Bool,
    'account_identifier' : IDL.Text,
    'hardware_wallet_accounts' : IDL.Vec(HardwareWalletAccountDetails),
    'ii_anchor' : IDL.Text,
    'sub_accounts' : IDL.Vec(SubAccountDetails),
  });
  return IDL.Service({
    'admin_e2e_reset' : IDL.Func([IDL.Text], [], []),
    'admin_list_missing_id_users' : IDL.Func(
        [],
        [IDL.Vec(IDL.Text)],
        ['query'],
      ),
    'admin_salt_get' : IDL.Func([], [IDL.Opt(IDL.Vec(IDL.Nat8))], ['query']),
    'admin_salt_set' : IDL.Func([IDL.Vec(IDL.Nat8)], [], []),
    'admin_user_id_update' : IDL.Func([IDL.Nat64], [IDL.Text], []),
    'admin_user_id_update_batch' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [Result],
        [],
      ),
    'admin_user_info_get' : IDL.Func([IDL.Nat64], [MEUser], []),
    'backup_change_status' : IDL.Func([BackupStatus], [Result], []),
    'backup_info_get' : IDL.Func([], [Result_1], []),
    'backup_job_list' : IDL.Func([], [Result_2], []),
    'balance_get' : IDL.Func([], [Result_3], ['query']),
    'controller_user_get' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(IDL.Principal)],
        ['query'],
      ),
    'controller_user_install' : IDL.Func(
        [IDL.Text],
        [InstallControllerResponse],
        [],
      ),
    'controller_user_upgrade' : IDL.Func([], [], []),
    'device_e2e_add' : IDL.Func(
        [IDL.Text, E2EDeviceRequest],
        [DeviceAddResponse],
        [],
      ),
    'device_e2e_manage_pub_key_exists' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Nat8)],
        [Result_4],
        [],
      ),
    'device_main_add' : IDL.Func(
        [IDL.Text, DeviceDataExternal, IDL.Opt(E2EDeviceRequest)],
        [DeviceAddResponse],
        [],
      ),
    'device_main_get' : IDL.Func(
        [IDL.Text, IDL.Opt(DeviceType)],
        [IDL.Vec(DeviceDataExternal)],
        ['query'],
      ),
    'device_main_get_v1' : IDL.Func(
        [IDL.Text, IDL.Opt(DeviceType)],
        [IDL.Vec(DeviceDataExternalV1)],
        ['query'],
      ),
    'device_main_get_v2' : IDL.Func(
        [IDL.Text, IDL.Opt(DeviceType)],
        [IDL.Vec(DeviceDataExternal)],
        ['query'],
      ),
    'device_main_recovery' : IDL.Func(
        [IDL.Text, DeviceDataExternal, IDL.Opt(E2EDeviceRequest)],
        [DeviceAddResponse],
        [],
      ),
    'device_main_remove' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Nat8)],
        [DeviceRemoveResponse],
        [],
      ),
    'device_main_update' : IDL.Func(
        [IDL.Text, DeviceDataExternal],
        [DeviceUpdateResponse],
        [],
      ),
    'device_main_update_self' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Opt(EncDoc), IDL.Opt(IDL.Vec(IDL.Nat8))],
        [Result_5],
        [],
      ),
    'device_tentative_add' : IDL.Func(
        [IDL.Text, IDL.Principal, DeviceDataExternal],
        [Result_6],
        [],
      ),
    'device_tentative_enter' : IDL.Func([IDL.Text], [Result_7], []),
    'device_tentative_exit' : IDL.Func([IDL.Text], [Result_8], []),
    'device_tentative_has' : IDL.Func([IDL.Text], [IDL.Bool], ['query']),
    'device_tentative_verify' : IDL.Func(
        [IDL.Text, IDL.Text, VerifyTentativeMode, IDL.Opt(EncDoc)],
        [Result_9],
        [],
      ),
    'ego_app_info_get' : IDL.Func([], [Result_10], ['query']),
    'ego_app_info_update' : IDL.Func(
        [IDL.Opt(IDL.Principal), IDL.Text, Version],
        [],
        [],
      ),
    'ego_app_version_check' : IDL.Func([], [Result_10], []),
    'ego_canister_add' : IDL.Func([IDL.Text, IDL.Principal], [Result], []),
    'ego_canister_delete' : IDL.Func([], [Result], []),
    'ego_canister_list' : IDL.Func([], [Result_11], []),
    'ego_canister_remove' : IDL.Func([IDL.Text, IDL.Principal], [Result], []),
    'ego_canister_track' : IDL.Func([], [Result], []),
    'ego_canister_untrack' : IDL.Func([], [Result], []),
    'ego_canister_upgrade' : IDL.Func([], [Result], []),
    'ego_controller_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_controller_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_controller_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'ego_cycle_check' : IDL.Func([], [Result], []),
    'ego_cycle_estimate_set' : IDL.Func([IDL.Nat64], [Result], []),
    'ego_cycle_history' : IDL.Func([], [Result_12], []),
    'ego_cycle_info' : IDL.Func([], [Result_13], []),
    'ego_cycle_recharge' : IDL.Func([IDL.Nat], [Result], []),
    'ego_cycle_threshold_get' : IDL.Func([], [Result_3], []),
    'ego_is_op' : IDL.Func([], [Result_8], ['query']),
    'ego_is_owner' : IDL.Func([], [Result_8], ['query']),
    'ego_is_user' : IDL.Func([], [Result_8], ['query']),
    'ego_log_list' : IDL.Func([IDL.Nat64], [Result_14], ['query']),
    'ego_op_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_op_list' : IDL.Func([], [Result_15], []),
    'ego_op_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_add_with_name' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result],
        [],
      ),
    'ego_owner_list' : IDL.Func([], [Result_15], []),
    'ego_owner_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'ego_runtime_cycle_threshold_get' : IDL.Func([], [Result_3], []),
    'ego_user_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_user_list' : IDL.Func([], [Result_15], []),
    'ego_user_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_user_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'finish_backup' : IDL.Func([], [], []),
    'finish_restore' : IDL.Func([], [], []),
    'id_delegation_get' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Vec(IDL.Nat8),
          DelegationMode,
          IDL.Nat64,
          IDL.Opt(IDL.Vec(IDL.Principal)),
          IDL.Bool,
        ],
        [GetDelegationResponse],
        ['query'],
      ),
    'id_delegation_prepare' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Vec(IDL.Nat8),
          DelegationMode,
          IDL.Opt(IDL.Nat64),
          IDL.Opt(IDL.Vec(IDL.Principal)),
          IDL.Bool,
        ],
        [PrepareDelegationResponse],
        [],
      ),
    'id_user_add' : IDL.Func(
        [
          IDL.Text,
          DeviceDataExternal,
          RegisterEvent,
          IDL.Opt(E2EDeviceRequest),
        ],
        [RegisterResponse],
        [],
      ),
    'is_username_exists' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'job_data_export' : IDL.Func(
        [
          IDL.Text,
          IDL.Nat64,
          IDL.Nat64,
          IDL.Opt(BackupExportFormat),
          IDL.Opt(IDL.Nat64),
        ],
        [Result_16],
        [],
      ),
    'job_data_import' : IDL.Func([ByteWriteRequest], [Result_8], []),
    'job_data_read' : IDL.Func(
        [IDL.Text, IDL.Nat64, IDL.Nat64],
        [Result_8],
        [],
      ),
    'job_data_write' : IDL.Func(
        [IDL.Text, IDL.Nat64, IDL.Nat64, IDL.Bool],
        [Result_8],
        [],
      ),
    'jwt_token_get' : IDL.Func([IDL.Text], [IDL.Opt(IDL.Text)], ['query']),
    'start_backup' : IDL.Func([], [], []),
    'start_restore' : IDL.Func([IDL.Vec(BackupJob)], [], []),
    'user_name_to_user_id' : IDL.Func([IDL.Text], [Result_17], ['query']),
    'wallet_me_add' : IDL.Func(
        [IDL.Text, MEAccountDetails],
        [UpdateMEWalletResponse],
        [],
      ),
    'wallet_me_remove' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [UpdateMEWalletResponse],
        [],
      ),
    'wallet_nns_add' : IDL.Func(
        [IDL.Text, NNSAccountDetails],
        [UpdateMEWalletResponse],
        [],
      ),
    'wallet_nns_remove' : IDL.Func(
        [IDL.Text, IDL.Text],
        [UpdateMEWalletResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
