export const idlFactory = ({ IDL }) => {
  const Error = IDL.Text;
  const BoolHttpResponse = IDL.Record({
    'data' : IDL.Opt(IDL.Bool),
    'error' : IDL.Opt(Error),
    'status_code' : IDL.Nat16,
  });
  const ConfigurationRequest = IDL.Record({
    'env' : IDL.Opt(IDL.Text),
    'whitelisted_phone_numbers' : IDL.Opt(IDL.Vec(IDL.Text)),
    'backup_canister_id' : IDL.Opt(IDL.Text),
    'ii_canister_id' : IDL.Opt(IDL.Principal),
    'whitelisted_canisters' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'operator' : IDL.Opt(IDL.Principal),
    'git_branch' : IDL.Opt(IDL.Text),
    'lambda' : IDL.Opt(IDL.Principal),
    'lambda_url' : IDL.Opt(IDL.Text),
    'token_refresh_ttl' : IDL.Opt(IDL.Nat64),
    'account_creation_paused' : IDL.Opt(IDL.Bool),
    'heartbeat' : IDL.Opt(IDL.Nat32),
    'token_ttl' : IDL.Opt(IDL.Nat64),
    'commit_hash' : IDL.Opt(IDL.Text),
  });
  const DeviceType = IDL.Variant({
    'Email' : IDL.Null,
    'Password' : IDL.Null,
    'Passkey' : IDL.Null,
    'Recovery' : IDL.Null,
    'Unknown' : IDL.Null,
  });
  const AccessPointRequest = IDL.Record({
    'icon' : IDL.Text,
    'device_type' : DeviceType,
    'device' : IDL.Text,
    'pub_key' : IDL.Text,
    'browser' : IDL.Text,
    'credential_id' : IDL.Opt(IDL.Text),
  });
  const AccessPointResponse = IDL.Record({
    'icon' : IDL.Text,
    'device_type' : DeviceType,
    'device' : IDL.Text,
    'browser' : IDL.Text,
    'last_used' : IDL.Nat64,
    'principal_id' : IDL.Text,
    'credential_id' : IDL.Opt(IDL.Text),
  });
  const HTTPAccessPointResponse = IDL.Record({
    'data' : IDL.Opt(IDL.Vec(AccessPointResponse)),
    'error' : IDL.Opt(Error),
    'status_code' : IDL.Nat16,
  });
  const WalletVariant = IDL.Variant({ 'II' : IDL.Null, 'NFID' : IDL.Null });
  const HTTPAccountRequest = IDL.Record({
    'anchor' : IDL.Nat64,
    'email' : IDL.Opt(IDL.Text),
    'access_point' : IDL.Opt(AccessPointRequest),
    'wallet' : IDL.Opt(WalletVariant),
  });
  const PersonaResponse = IDL.Record({
    'domain' : IDL.Text,
    'persona_name' : IDL.Text,
    'persona_id' : IDL.Text,
  });
  const AccountResponse = IDL.Record({
    'name' : IDL.Opt(IDL.Text),
    'anchor' : IDL.Nat64,
    'access_points' : IDL.Vec(AccessPointResponse),
    'email' : IDL.Opt(IDL.Text),
    'personas' : IDL.Vec(PersonaResponse),
    'is2fa_enabled' : IDL.Bool,
    'wallet' : WalletVariant,
    'principal_id' : IDL.Text,
    'phone_number' : IDL.Opt(IDL.Text),
  });
  const HTTPAccountResponse = IDL.Record({
    'data' : IDL.Opt(AccountResponse),
    'error' : IDL.Opt(Error),
    'status_code' : IDL.Nat16,
  });
  const ConfigurationResponse = IDL.Record({
    'env' : IDL.Opt(IDL.Text),
    'whitelisted_phone_numbers' : IDL.Opt(IDL.Vec(IDL.Text)),
    'backup_canister_id' : IDL.Opt(IDL.Text),
    'ii_canister_id' : IDL.Opt(IDL.Principal),
    'whitelisted_canisters' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'operator' : IDL.Opt(IDL.Principal),
    'git_branch' : IDL.Opt(IDL.Text),
    'lambda' : IDL.Opt(IDL.Principal),
    'lambda_url' : IDL.Opt(IDL.Text),
    'token_refresh_ttl' : IDL.Opt(IDL.Nat64),
    'account_creation_paused' : IDL.Opt(IDL.Bool),
    'heartbeat' : IDL.Opt(IDL.Nat32),
    'token_ttl' : IDL.Opt(IDL.Nat64),
    'commit_hash' : IDL.Opt(IDL.Text),
  });
  const CertifiedResponse = IDL.Record({
    'certificate' : IDL.Vec(IDL.Nat8),
    'witness' : IDL.Vec(IDL.Nat8),
    'response' : IDL.Text,
  });
  const Application = IDL.Record({
    'img' : IDL.Opt(IDL.Text),
    'alias' : IDL.Opt(IDL.Vec(IDL.Text)),
    'user_limit' : IDL.Nat16,
    'domain' : IDL.Text,
    'name' : IDL.Text,
    'is_nft_storage' : IDL.Opt(IDL.Bool),
    'is_trusted' : IDL.Opt(IDL.Bool),
    'is_iframe_allowed' : IDL.Opt(IDL.Bool),
  });
  const HTTPApplicationResponse = IDL.Record({
    'data' : IDL.Opt(IDL.Vec(Application)),
    'error' : IDL.Opt(Error),
    'status_code' : IDL.Nat16,
  });
  const HTTPPersonasResponse = IDL.Record({
    'data' : IDL.Opt(IDL.Vec(PersonaResponse)),
    'error' : IDL.Opt(Error),
    'status_code' : IDL.Nat16,
  });
  const AccessPointRemoveRequest = IDL.Record({ 'pub_key' : IDL.Text });
  const BasicEntity = IDL.Record({
    'modified_date' : IDL.Nat64,
    'created_date' : IDL.Nat64,
  });
  const Account = IDL.Record({
    'name' : IDL.Opt(IDL.Text),
    'anchor' : IDL.Nat64,
    'access_points' : IDL.Vec(AccessPointRequest),
    'email' : IDL.Opt(IDL.Text),
    'basic_entity' : BasicEntity,
    'personas' : IDL.Vec(PersonaResponse),
    'wallet' : WalletVariant,
    'principal_id' : IDL.Text,
    'phone_number' : IDL.Opt(IDL.Text),
  });
  const HTTPAccountUpdateRequest = IDL.Record({
    'name' : IDL.Opt(IDL.Text),
    'email' : IDL.Opt(IDL.Text),
  });
  const HTTPOneAccessPointResponse = IDL.Record({
    'data' : IDL.Opt(AccessPointResponse),
    'error' : IDL.Opt(Error),
    'status_code' : IDL.Nat16,
  });
  return IDL.Service({
    'add_email_and_principal_for_create_account_validation' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat64],
        [BoolHttpResponse],
        [],
      ),
    'configure' : IDL.Func([ConfigurationRequest], [], []),
    'count_anchors' : IDL.Func([], [IDL.Nat64], ['query']),
    'create_access_point' : IDL.Func(
        [AccessPointRequest],
        [HTTPAccessPointResponse],
        [],
      ),
    'create_account' : IDL.Func(
        [HTTPAccountRequest],
        [HTTPAccountResponse],
        [],
      ),
    'get_account' : IDL.Func([], [HTTPAccountResponse], ['query']),
    'get_account_by_anchor' : IDL.Func(
        [IDL.Nat64],
        [HTTPAccountResponse],
        ['query'],
      ),
    'get_account_by_principal' : IDL.Func(
        [IDL.Text],
        [HTTPAccountResponse],
        ['query'],
      ),
    'get_all_accounts_json' : IDL.Func(
        [IDL.Nat32, IDL.Nat32],
        [IDL.Text],
        ['query'],
      ),
    'get_config' : IDL.Func([], [ConfigurationResponse], ['query']),
    'get_remaining_size_after_rebuild_device_index_slice_from_temp_stack' : IDL.Func(
        [IDL.Opt(IDL.Nat64)],
        [IDL.Nat64],
        [],
      ),
    'get_root_certified' : IDL.Func([], [CertifiedResponse], ['query']),
    'pause_account_creation' : IDL.Func([IDL.Bool], [], []),
    'read_access_points' : IDL.Func([], [HTTPAccessPointResponse], ['query']),
    'read_applications' : IDL.Func([], [HTTPApplicationResponse], ['query']),
    'read_personas' : IDL.Func([], [HTTPPersonasResponse], ['query']),
    'remove_access_point' : IDL.Func(
        [AccessPointRemoveRequest],
        [HTTPAccessPointResponse],
        [],
      ),
    'remove_account' : IDL.Func([], [BoolHttpResponse], []),
    'remove_account_by_principal' : IDL.Func(
        [IDL.Text],
        [BoolHttpResponse],
        [],
      ),
    'restore_accounts' : IDL.Func([IDL.Text], [BoolHttpResponse], []),
    'save_temp_stack_to_rebuild_device_index' : IDL.Func([], [IDL.Text], []),
    'store_accounts' : IDL.Func([IDL.Vec(Account)], [BoolHttpResponse], []),
    'sync_controllers' : IDL.Func([], [IDL.Vec(IDL.Text)], []),
    'sync_recovery_phrase_from_internet_identity' : IDL.Func(
        [IDL.Nat64],
        [HTTPAccountResponse],
        [],
      ),
    'update_2fa' : IDL.Func([IDL.Bool], [AccountResponse], []),
    'update_access_point' : IDL.Func(
        [AccessPointRequest],
        [HTTPAccessPointResponse],
        [],
      ),
    'update_account' : IDL.Func(
        [HTTPAccountUpdateRequest],
        [HTTPAccountResponse],
        [],
      ),
    'use_access_point' : IDL.Func(
        [IDL.Opt(IDL.Text)],
        [HTTPOneAccessPointResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
