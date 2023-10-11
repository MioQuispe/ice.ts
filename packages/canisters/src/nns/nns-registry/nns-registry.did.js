export const idlFactory = ({ IDL }) => {
  const FirewallRulesScope = IDL.Variant({
    'Node' : IDL.Principal,
    'ReplicaNodes' : IDL.Null,
    'Subnet' : IDL.Principal,
    'Global' : IDL.Null,
  });
  const FirewallRule = IDL.Record({
    'ipv4_prefixes' : IDL.Vec(IDL.Text),
    'direction' : IDL.Opt(IDL.Int32),
    'action' : IDL.Int32,
    'user' : IDL.Opt(IDL.Text),
    'comment' : IDL.Text,
    'ipv6_prefixes' : IDL.Vec(IDL.Text),
    'ports' : IDL.Vec(IDL.Nat32),
  });
  const AddFirewallRulesPayload = IDL.Record({
    'expected_hash' : IDL.Text,
    'scope' : FirewallRulesScope,
    'positions' : IDL.Vec(IDL.Int32),
    'rules' : IDL.Vec(FirewallRule),
  });
  const AddHostOsVersionPayload = IDL.Record({
    'release_package_urls' : IDL.Vec(IDL.Text),
    'hostos_version_id' : IDL.Text,
    'release_package_sha256_hex' : IDL.Text,
  });
  const AddNodePayload = IDL.Record({
    'prometheus_metrics_endpoint' : IDL.Text,
    'http_endpoint' : IDL.Text,
    'idkg_dealing_encryption_pk' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'xnet_endpoint' : IDL.Text,
    'committee_signing_pk' : IDL.Vec(IDL.Nat8),
    'node_signing_pk' : IDL.Vec(IDL.Nat8),
    'transport_tls_cert' : IDL.Vec(IDL.Nat8),
    'ni_dkg_dealing_encryption_pk' : IDL.Vec(IDL.Nat8),
    'p2p_flow_endpoints' : IDL.Vec(IDL.Text),
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Principal, 'Err' : IDL.Text });
  const AddNodeOperatorPayload = IDL.Record({
    'ipv6' : IDL.Opt(IDL.Text),
    'node_operator_principal_id' : IDL.Opt(IDL.Principal),
    'node_allowance' : IDL.Nat64,
    'rewardable_nodes' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat32)),
    'node_provider_principal_id' : IDL.Opt(IDL.Principal),
    'dc_id' : IDL.Text,
  });
  const AddNodesToSubnetPayload = IDL.Record({
    'subnet_id' : IDL.Principal,
    'node_ids' : IDL.Vec(IDL.Principal),
  });
  const Gps = IDL.Record({
    'latitude' : IDL.Float32,
    'longitude' : IDL.Float32,
  });
  const DataCenterRecord = IDL.Record({
    'id' : IDL.Text,
    'gps' : IDL.Opt(Gps),
    'region' : IDL.Text,
    'owner' : IDL.Text,
  });
  const AddOrRemoveDataCentersProposalPayload = IDL.Record({
    'data_centers_to_add' : IDL.Vec(DataCenterRecord),
    'data_centers_to_remove' : IDL.Vec(IDL.Text),
  });
  const BlessReplicaVersionPayload = IDL.Record({
    'release_package_urls' : IDL.Opt(IDL.Vec(IDL.Text)),
    'node_manager_sha256_hex' : IDL.Text,
    'release_package_url' : IDL.Text,
    'sha256_hex' : IDL.Text,
    'guest_launch_measurement_sha256_hex' : IDL.Opt(IDL.Text),
    'replica_version_id' : IDL.Text,
    'release_package_sha256_hex' : IDL.Text,
    'node_manager_binary_url' : IDL.Text,
    'binary_url' : IDL.Text,
  });
  const ChangeSubnetMembershipPayload = IDL.Record({
    'node_ids_add' : IDL.Vec(IDL.Principal),
    'subnet_id' : IDL.Principal,
    'node_ids_remove' : IDL.Vec(IDL.Principal),
  });
  const CanisterIdRange = IDL.Record({
    'end' : IDL.Principal,
    'start' : IDL.Principal,
  });
  const CompleteCanisterMigrationPayload = IDL.Record({
    'canister_id_ranges' : IDL.Vec(CanisterIdRange),
    'migration_trace' : IDL.Vec(IDL.Principal),
  });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const SevFeatureStatus = IDL.Variant({
    'SecureEnabled' : IDL.Null,
    'Disabled' : IDL.Null,
    'InsecureIntegrityEnabled' : IDL.Null,
    'SecureNoUpgradeEnabled' : IDL.Null,
    'InsecureEnabled' : IDL.Null,
  });
  const SubnetFeatures = IDL.Record({
    'canister_sandboxing' : IDL.Bool,
    'sev_status' : IDL.Opt(SevFeatureStatus),
    'http_requests' : IDL.Bool,
  });
  const EcdsaCurve = IDL.Variant({ 'secp256k1' : IDL.Null });
  const EcdsaKeyId = IDL.Record({ 'name' : IDL.Text, 'curve' : EcdsaCurve });
  const EcdsaKeyRequest = IDL.Record({
    'key_id' : EcdsaKeyId,
    'subnet_id' : IDL.Opt(IDL.Principal),
  });
  const EcdsaInitialConfig = IDL.Record({
    'quadruples_to_create_in_advance' : IDL.Nat32,
    'max_queue_size' : IDL.Opt(IDL.Nat32),
    'keys' : IDL.Vec(EcdsaKeyRequest),
    'signature_request_timeout_ns' : IDL.Opt(IDL.Nat64),
    'idkg_key_rotation_period_ms' : IDL.Opt(IDL.Nat64),
  });
  const SubnetType = IDL.Variant({
    'application' : IDL.Null,
    'verified_application' : IDL.Null,
    'system' : IDL.Null,
  });
  const CreateSubnetPayload = IDL.Record({
    'unit_delay_millis' : IDL.Nat64,
    'max_instructions_per_round' : IDL.Nat64,
    'features' : SubnetFeatures,
    'max_instructions_per_message' : IDL.Nat64,
    'gossip_registry_poll_period_ms' : IDL.Nat32,
    'max_ingress_bytes_per_message' : IDL.Nat64,
    'dkg_dealings_per_block' : IDL.Nat64,
    'max_block_payload_size' : IDL.Nat64,
    'max_instructions_per_install_code' : IDL.Nat64,
    'start_as_nns' : IDL.Bool,
    'is_halted' : IDL.Bool,
    'gossip_pfn_evaluation_period_ms' : IDL.Nat32,
    'max_ingress_messages_per_block' : IDL.Nat64,
    'max_number_of_canisters' : IDL.Nat64,
    'ecdsa_config' : IDL.Opt(EcdsaInitialConfig),
    'gossip_max_artifact_streams_per_peer' : IDL.Nat32,
    'replica_version_id' : IDL.Text,
    'gossip_max_duplicity' : IDL.Nat32,
    'gossip_max_chunk_wait_ms' : IDL.Nat32,
    'dkg_interval_length' : IDL.Nat64,
    'subnet_id_override' : IDL.Opt(IDL.Principal),
    'ssh_backup_access' : IDL.Vec(IDL.Text),
    'ingress_bytes_per_block_soft_cap' : IDL.Nat64,
    'initial_notary_delay_millis' : IDL.Nat64,
    'gossip_max_chunk_size' : IDL.Nat32,
    'subnet_type' : SubnetType,
    'ssh_readonly_access' : IDL.Vec(IDL.Text),
    'gossip_retransmission_request_ms' : IDL.Nat32,
    'gossip_receive_check_cache_size' : IDL.Nat32,
    'node_ids' : IDL.Vec(IDL.Principal),
  });
  const DeleteSubnetPayload = IDL.Record({
    'subnet_id' : IDL.Opt(IDL.Principal),
  });
  const NodeOperatorRecord = IDL.Record({
    'ipv6' : IDL.Opt(IDL.Text),
    'node_operator_principal_id' : IDL.Vec(IDL.Nat8),
    'node_allowance' : IDL.Nat64,
    'rewardable_nodes' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat32)),
    'node_provider_principal_id' : IDL.Vec(IDL.Nat8),
    'dc_id' : IDL.Text,
  });
  const Result_2 = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Tuple(DataCenterRecord, NodeOperatorRecord)),
    'Err' : IDL.Text,
  });
  const NodeProvidersMonthlyXdrRewards = IDL.Record({
    'rewards' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat64)),
  });
  const Result_3 = IDL.Variant({
    'Ok' : NodeProvidersMonthlyXdrRewards,
    'Err' : IDL.Text,
  });
  const GetSubnetForCanisterRequest = IDL.Record({
    'principal' : IDL.Opt(IDL.Principal),
  });
  const GetSubnetForCanisterResponse = IDL.Record({
    'subnet_id' : IDL.Opt(IDL.Principal),
  });
  const Result_4 = IDL.Variant({
    'Ok' : GetSubnetForCanisterResponse,
    'Err' : IDL.Text,
  });
  const PrepareCanisterMigrationPayload = IDL.Record({
    'canister_id_ranges' : IDL.Vec(CanisterIdRange),
    'source_subnet' : IDL.Principal,
    'destination_subnet' : IDL.Principal,
  });
  const RecoverSubnetPayload = IDL.Record({
    'height' : IDL.Nat64,
    'replacement_nodes' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'subnet_id' : IDL.Principal,
    'registry_store_uri' : IDL.Opt(IDL.Tuple(IDL.Text, IDL.Text, IDL.Nat64)),
    'ecdsa_config' : IDL.Opt(EcdsaInitialConfig),
    'state_hash' : IDL.Vec(IDL.Nat8),
    'time_ns' : IDL.Nat64,
  });
  const RemoveFirewallRulesPayload = IDL.Record({
    'expected_hash' : IDL.Text,
    'scope' : FirewallRulesScope,
    'positions' : IDL.Vec(IDL.Int32),
  });
  const RemoveNodeDirectlyPayload = IDL.Record({ 'node_id' : IDL.Principal });
  const RemoveNodeOperatorsPayload = IDL.Record({
    'node_operators_to_remove' : IDL.Vec(IDL.Vec(IDL.Nat8)),
  });
  const RemoveNodesPayload = IDL.Record({
    'node_ids' : IDL.Vec(IDL.Principal),
  });
  const RerouteCanisterRangesPayload = IDL.Record({
    'source_subnet' : IDL.Principal,
    'reassigned_canister_ranges' : IDL.Vec(CanisterIdRange),
    'destination_subnet' : IDL.Principal,
  });
  const RetireReplicaVersionPayload = IDL.Record({
    'replica_version_ids' : IDL.Vec(IDL.Text),
  });
  const SetFirewallConfigPayload = IDL.Record({
    'ipv4_prefixes' : IDL.Vec(IDL.Text),
    'firewall_config' : IDL.Text,
    'ipv6_prefixes' : IDL.Vec(IDL.Text),
  });
  const UpdateElectedReplicaVersionsPayload = IDL.Record({
    'release_package_urls' : IDL.Vec(IDL.Text),
    'replica_versions_to_unelect' : IDL.Vec(IDL.Text),
    'replica_version_to_elect' : IDL.Opt(IDL.Text),
    'guest_launch_measurement_sha256_hex' : IDL.Opt(IDL.Text),
    'release_package_sha256_hex' : IDL.Opt(IDL.Text),
  });
  const UpdateNodeDirectlyPayload = IDL.Record({
    'idkg_dealing_encryption_pk' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const UpdateNodeOperatorConfigPayload = IDL.Record({
    'node_operator_id' : IDL.Opt(IDL.Principal),
    'set_ipv6_to_none' : IDL.Opt(IDL.Bool),
    'ipv6' : IDL.Opt(IDL.Text),
    'node_provider_id' : IDL.Opt(IDL.Principal),
    'node_allowance' : IDL.Opt(IDL.Nat64),
    'rewardable_nodes' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat32)),
    'dc_id' : IDL.Opt(IDL.Text),
  });
  const UpdateNodeOperatorConfigDirectlyPayload = IDL.Record({
    'node_operator_id' : IDL.Opt(IDL.Principal),
    'node_provider_id' : IDL.Opt(IDL.Principal),
  });
  const NodeRewardRate = IDL.Record({
    'xdr_permyriad_per_node_per_month' : IDL.Nat64,
    'reward_coefficient_percent' : IDL.Opt(IDL.Int32),
  });
  const NodeRewardRates = IDL.Record({
    'rates' : IDL.Vec(IDL.Tuple(IDL.Text, NodeRewardRate)),
  });
  const UpdateNodeRewardsTableProposalPayload = IDL.Record({
    'new_entries' : IDL.Vec(IDL.Tuple(IDL.Text, NodeRewardRates)),
  });
  const UpdateNodesHostOsVersionPayload = IDL.Record({
    'hostos_version_id' : IDL.Opt(IDL.Text),
    'node_ids' : IDL.Vec(IDL.Principal),
  });
  const EcdsaConfig = IDL.Record({
    'quadruples_to_create_in_advance' : IDL.Nat32,
    'max_queue_size' : IDL.Opt(IDL.Nat32),
    'key_ids' : IDL.Vec(EcdsaKeyId),
    'signature_request_timeout_ns' : IDL.Opt(IDL.Nat64),
    'idkg_key_rotation_period_ms' : IDL.Opt(IDL.Nat64),
  });
  const UpdateSubnetPayload = IDL.Record({
    'unit_delay_millis' : IDL.Opt(IDL.Nat64),
    'max_duplicity' : IDL.Opt(IDL.Nat32),
    'max_instructions_per_round' : IDL.Opt(IDL.Nat64),
    'features' : IDL.Opt(SubnetFeatures),
    'set_gossip_config_to_default' : IDL.Bool,
    'max_instructions_per_message' : IDL.Opt(IDL.Nat64),
    'halt_at_cup_height' : IDL.Opt(IDL.Bool),
    'pfn_evaluation_period_ms' : IDL.Opt(IDL.Nat32),
    'subnet_id' : IDL.Principal,
    'max_ingress_bytes_per_message' : IDL.Opt(IDL.Nat64),
    'dkg_dealings_per_block' : IDL.Opt(IDL.Nat64),
    'ecdsa_key_signing_disable' : IDL.Opt(IDL.Vec(EcdsaKeyId)),
    'max_block_payload_size' : IDL.Opt(IDL.Nat64),
    'max_instructions_per_install_code' : IDL.Opt(IDL.Nat64),
    'start_as_nns' : IDL.Opt(IDL.Bool),
    'is_halted' : IDL.Opt(IDL.Bool),
    'max_ingress_messages_per_block' : IDL.Opt(IDL.Nat64),
    'max_number_of_canisters' : IDL.Opt(IDL.Nat64),
    'ecdsa_config' : IDL.Opt(EcdsaConfig),
    'retransmission_request_ms' : IDL.Opt(IDL.Nat32),
    'dkg_interval_length' : IDL.Opt(IDL.Nat64),
    'registry_poll_period_ms' : IDL.Opt(IDL.Nat32),
    'max_chunk_wait_ms' : IDL.Opt(IDL.Nat32),
    'receive_check_cache_size' : IDL.Opt(IDL.Nat32),
    'ecdsa_key_signing_enable' : IDL.Opt(IDL.Vec(EcdsaKeyId)),
    'ssh_backup_access' : IDL.Opt(IDL.Vec(IDL.Text)),
    'max_chunk_size' : IDL.Opt(IDL.Nat32),
    'initial_notary_delay_millis' : IDL.Opt(IDL.Nat64),
    'max_artifact_streams_per_peer' : IDL.Opt(IDL.Nat32),
    'subnet_type' : IDL.Opt(SubnetType),
    'ssh_readonly_access' : IDL.Opt(IDL.Vec(IDL.Text)),
  });
  const UpdateSubnetReplicaVersionPayload = IDL.Record({
    'subnet_id' : IDL.Principal,
    'replica_version_id' : IDL.Text,
  });
  const UpdateUnassignedNodesConfigPayload = IDL.Record({
    'replica_version' : IDL.Opt(IDL.Text),
    'ssh_readonly_access' : IDL.Opt(IDL.Vec(IDL.Text)),
  });
  return IDL.Service({
    'add_firewall_rules' : IDL.Func([AddFirewallRulesPayload], [], []),
    'add_hostos_version' : IDL.Func([AddHostOsVersionPayload], [], []),
    'add_node' : IDL.Func([AddNodePayload], [Result], []),
    'add_node_operator' : IDL.Func([AddNodeOperatorPayload], [], []),
    'add_nodes_to_subnet' : IDL.Func([AddNodesToSubnetPayload], [], []),
    'add_or_remove_data_centers' : IDL.Func(
        [AddOrRemoveDataCentersProposalPayload],
        [],
        [],
      ),
    'bless_replica_version' : IDL.Func([BlessReplicaVersionPayload], [], []),
    'change_subnet_membership' : IDL.Func(
        [ChangeSubnetMembershipPayload],
        [],
        [],
      ),
    'clear_provisional_whitelist' : IDL.Func([], [], []),
    'complete_canister_migration' : IDL.Func(
        [CompleteCanisterMigrationPayload],
        [Result_1],
        [],
      ),
    'create_subnet' : IDL.Func([CreateSubnetPayload], [], []),
    'delete_subnet' : IDL.Func([DeleteSubnetPayload], [], []),
    'get_build_metadata' : IDL.Func([], [IDL.Text], ['query']),
    'get_node_operators_and_dcs_of_node_provider' : IDL.Func(
        [IDL.Principal],
        [Result_2],
        ['query'],
      ),
    'get_node_providers_monthly_xdr_rewards' : IDL.Func(
        [],
        [Result_3],
        ['query'],
      ),
    'get_subnet_for_canister' : IDL.Func(
        [GetSubnetForCanisterRequest],
        [Result_4],
        ['query'],
      ),
    'prepare_canister_migration' : IDL.Func(
        [PrepareCanisterMigrationPayload],
        [Result_1],
        [],
      ),
    'recover_subnet' : IDL.Func([RecoverSubnetPayload], [], []),
    'remove_firewall_rules' : IDL.Func([RemoveFirewallRulesPayload], [], []),
    'remove_node_directly' : IDL.Func([RemoveNodeDirectlyPayload], [], []),
    'remove_node_operators' : IDL.Func([RemoveNodeOperatorsPayload], [], []),
    'remove_nodes' : IDL.Func([RemoveNodesPayload], [], []),
    'remove_nodes_from_subnet' : IDL.Func([RemoveNodesPayload], [], []),
    'reroute_canister_ranges' : IDL.Func(
        [RerouteCanisterRangesPayload],
        [Result_1],
        [],
      ),
    'retire_replica_version' : IDL.Func([RetireReplicaVersionPayload], [], []),
    'set_firewall_config' : IDL.Func([SetFirewallConfigPayload], [], []),
    'update_elected_replica_versions' : IDL.Func(
        [UpdateElectedReplicaVersionsPayload],
        [],
        [],
      ),
    'update_firewall_rules' : IDL.Func([AddFirewallRulesPayload], [], []),
    'update_node_directly' : IDL.Func(
        [UpdateNodeDirectlyPayload],
        [Result_1],
        [],
      ),
    'update_node_operator_config' : IDL.Func(
        [UpdateNodeOperatorConfigPayload],
        [],
        [],
      ),
    'update_node_operator_config_directly' : IDL.Func(
        [UpdateNodeOperatorConfigDirectlyPayload],
        [],
        [],
      ),
    'update_node_rewards_table' : IDL.Func(
        [UpdateNodeRewardsTableProposalPayload],
        [],
        [],
      ),
    'update_nodes_hostos_version' : IDL.Func(
        [UpdateNodesHostOsVersionPayload],
        [],
        [],
      ),
    'update_subnet' : IDL.Func([UpdateSubnetPayload], [], []),
    'update_subnet_replica_version' : IDL.Func(
        [UpdateSubnetReplicaVersionPayload],
        [],
        [],
      ),
    'update_unassigned_nodes_config' : IDL.Func(
        [UpdateUnassignedNodesConfigPayload],
        [],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
