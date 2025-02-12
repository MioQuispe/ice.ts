import type { Principal } from '@dfinity/principal';
export interface AddApiBoundaryNodesPayload {
  'version' : string,
  'node_ids' : Array<Principal>,
}
export interface AddFirewallRulesPayload {
  'expected_hash' : string,
  'scope' : FirewallRulesScope,
  'positions' : Array<number>,
  'rules' : Array<FirewallRule>,
}
export interface AddNodeOperatorPayload {
  'ipv6' : [] | [string],
  'node_operator_principal_id' : [] | [Principal],
  'node_allowance' : bigint,
  'rewardable_nodes' : Array<[string, number]>,
  'node_provider_principal_id' : [] | [Principal],
  'dc_id' : string,
}
export interface AddNodePayload {
  'prometheus_metrics_endpoint' : string,
  'http_endpoint' : string,
  'idkg_dealing_encryption_pk' : [] | [Array<number>],
  'domain' : [] | [string],
  'public_ipv4_config' : [] | [IPv4Config],
  'xnet_endpoint' : string,
  'chip_id' : [] | [Array<number>],
  'committee_signing_pk' : Array<number>,
  'node_reward_type' : [] | [string],
  'node_signing_pk' : Array<number>,
  'transport_tls_cert' : Array<number>,
  'ni_dkg_dealing_encryption_pk' : Array<number>,
  'p2p_flow_endpoints' : Array<string>,
}
export interface AddNodesToSubnetPayload {
  'subnet_id' : Principal,
  'node_ids' : Array<Principal>,
}
export interface AddOrRemoveDataCentersProposalPayload {
  'data_centers_to_add' : Array<DataCenterRecord>,
  'data_centers_to_remove' : Array<string>,
}
export interface ApiBoundaryNodeIdRecord { 'id' : [] | [Principal] }
export interface CanisterIdRange { 'end' : Principal, 'start' : Principal }
export interface ChainKeyConfig {
  'signature_request_timeout_ns' : [] | [bigint],
  'key_configs' : Array<KeyConfig>,
  'idkg_key_rotation_period_ms' : [] | [bigint],
}
export interface ChangeSubnetMembershipPayload {
  'node_ids_add' : Array<Principal>,
  'subnet_id' : Principal,
  'node_ids_remove' : Array<Principal>,
}
export interface CompleteCanisterMigrationPayload {
  'canister_id_ranges' : Array<CanisterIdRange>,
  'migration_trace' : Array<Principal>,
}
export interface CreateSubnetPayload {
  'unit_delay_millis' : bigint,
  'features' : SubnetFeatures,
  'gossip_registry_poll_period_ms' : number,
  'max_ingress_bytes_per_message' : bigint,
  'dkg_dealings_per_block' : bigint,
  'max_block_payload_size' : bigint,
  'start_as_nns' : boolean,
  'is_halted' : boolean,
  'gossip_pfn_evaluation_period_ms' : number,
  'max_ingress_messages_per_block' : bigint,
  'max_number_of_canisters' : bigint,
  'ecdsa_config' : [] | [EcdsaInitialConfig],
  'gossip_max_artifact_streams_per_peer' : number,
  'replica_version_id' : string,
  'gossip_max_duplicity' : number,
  'gossip_max_chunk_wait_ms' : number,
  'dkg_interval_length' : bigint,
  'subnet_id_override' : [] | [Principal],
  'ssh_backup_access' : Array<string>,
  'ingress_bytes_per_block_soft_cap' : bigint,
  'initial_notary_delay_millis' : bigint,
  'chain_key_config' : [] | [InitialChainKeyConfig],
  'gossip_max_chunk_size' : number,
  'subnet_type' : SubnetType,
  'ssh_readonly_access' : Array<string>,
  'gossip_retransmission_request_ms' : number,
  'gossip_receive_check_cache_size' : number,
  'node_ids' : Array<Principal>,
}
export interface DataCenterRecord {
  'id' : string,
  'gps' : [] | [Gps],
  'region' : string,
  'owner' : string,
}
export interface DeployGuestosToAllSubnetNodesPayload {
  'subnet_id' : Principal,
  'replica_version_id' : string,
}
export interface DeployGuestosToAllUnassignedNodesPayload {
  'elected_replica_version' : string,
}
export interface DeployGuestosToSomeApiBoundaryNodes {
  'version' : string,
  'node_ids' : Array<Principal>,
}
export interface DeployHostosToSomeNodes {
  'hostos_version_id' : [] | [string],
  'node_ids' : Array<Principal>,
}
export interface EcdsaConfig {
  'quadruples_to_create_in_advance' : number,
  'max_queue_size' : [] | [number],
  'key_ids' : Array<EcdsaKeyId>,
  'signature_request_timeout_ns' : [] | [bigint],
  'idkg_key_rotation_period_ms' : [] | [bigint],
}
export type EcdsaCurve = { 'secp256k1' : null };
export interface EcdsaInitialConfig {
  'quadruples_to_create_in_advance' : number,
  'max_queue_size' : [] | [number],
  'keys' : Array<EcdsaKeyRequest>,
  'signature_request_timeout_ns' : [] | [bigint],
  'idkg_key_rotation_period_ms' : [] | [bigint],
}
export interface EcdsaKeyId { 'name' : string, 'curve' : EcdsaCurve }
export interface EcdsaKeyRequest {
  'key_id' : EcdsaKeyId,
  'subnet_id' : [] | [Principal],
}
export interface FirewallRule {
  'ipv4_prefixes' : Array<string>,
  'direction' : [] | [number],
  'action' : number,
  'user' : [] | [string],
  'comment' : string,
  'ipv6_prefixes' : Array<string>,
  'ports' : Array<number>,
}
export type FirewallRulesScope = { 'Node' : Principal } |
  { 'ReplicaNodes' : null } |
  { 'ApiBoundaryNodes' : null } |
  { 'Subnet' : Principal } |
  { 'Global' : null };
export type GetApiBoundaryNodeIdsRequest = {};
export type GetApiBoundaryNodeIdsResponse = {
    'Ok' : Array<ApiBoundaryNodeIdRecord>
  } |
  { 'Err' : string };
export type GetNodeOperatorsAndDcsOfNodeProviderResponse = {
    'Ok' : Array<[DataCenterRecord, NodeOperatorRecord]>
  } |
  { 'Err' : string };
export type GetNodeProvidersMonthlyXdrRewardsResponse = {
    'Ok' : NodeProvidersMonthlyXdrRewards
  } |
  { 'Err' : string };
export interface GetSubnetForCanisterRequest { 'principal' : [] | [Principal] }
export type GetSubnetForCanisterResponse = {
    'Ok' : { 'subnet_id' : [] | [Principal] }
  } |
  { 'Err' : string };
export interface Gps { 'latitude' : number, 'longitude' : number }
export interface IPv4Config {
  'prefix_length' : number,
  'gateway_ip_addr' : string,
  'ip_addr' : string,
}
export interface InitialChainKeyConfig {
  'signature_request_timeout_ns' : [] | [bigint],
  'key_configs' : Array<KeyConfigRequest>,
  'idkg_key_rotation_period_ms' : [] | [bigint],
}
export interface KeyConfig {
  'max_queue_size' : [] | [number],
  'key_id' : [] | [MasterPublicKeyId],
  'pre_signatures_to_create_in_advance' : [] | [number],
}
export interface KeyConfigRequest {
  'subnet_id' : [] | [Principal],
  'key_config' : [] | [KeyConfig],
}
export type MasterPublicKeyId = { 'Schnorr' : SchnorrKeyId } |
  { 'VetKd' : VetKdKeyId } |
  { 'Ecdsa' : EcdsaKeyId };
export interface NodeOperatorPrincipals { 'principals' : Array<Principal> }
export interface NodeOperatorRecord {
  'ipv6' : [] | [string],
  'node_operator_principal_id' : Array<number>,
  'node_allowance' : bigint,
  'rewardable_nodes' : Array<[string, number]>,
  'node_provider_principal_id' : Array<number>,
  'dc_id' : string,
}
export interface NodeProvidersMonthlyXdrRewards {
  'registry_version' : [] | [bigint],
  'rewards' : Array<[string, bigint]>,
}
export interface NodeRewardRate {
  'xdr_permyriad_per_node_per_month' : bigint,
  'reward_coefficient_percent' : [] | [number],
}
export interface NodeRewardRates { 'rates' : Array<[string, NodeRewardRate]> }
export interface PrepareCanisterMigrationPayload {
  'canister_id_ranges' : Array<CanisterIdRange>,
  'source_subnet' : Principal,
  'destination_subnet' : Principal,
}
export interface RecoverSubnetPayload {
  'height' : bigint,
  'replacement_nodes' : [] | [Array<Principal>],
  'subnet_id' : Principal,
  'registry_store_uri' : [] | [[string, string, bigint]],
  'ecdsa_config' : [] | [EcdsaInitialConfig],
  'state_hash' : Array<number>,
  'chain_key_config' : [] | [InitialChainKeyConfig],
  'time_ns' : bigint,
}
export interface RemoveApiBoundaryNodesPayload { 'node_ids' : Array<Principal> }
export interface RemoveFirewallRulesPayload {
  'expected_hash' : string,
  'scope' : FirewallRulesScope,
  'positions' : Array<number>,
}
export interface RemoveNodeDirectlyPayload { 'node_id' : Principal }
export interface RemoveNodeOperatorsPayload {
  'node_operator_principals_to_remove' : [] | [NodeOperatorPrincipals],
  'node_operators_to_remove' : Array<Array<number>>,
}
export interface RemoveNodesFromSubnetPayload { 'node_ids' : Array<Principal> }
export interface RemoveNodesPayload { 'node_ids' : Array<Principal> }
export interface RerouteCanisterRangesPayload {
  'source_subnet' : Principal,
  'reassigned_canister_ranges' : Array<CanisterIdRange>,
  'destination_subnet' : Principal,
}
export interface ReviseElectedGuestosVersionsPayload {
  'release_package_urls' : Array<string>,
  'replica_versions_to_unelect' : Array<string>,
  'replica_version_to_elect' : [] | [string],
  'guest_launch_measurement_sha256_hex' : [] | [string],
  'release_package_sha256_hex' : [] | [string],
}
export interface ReviseElectedHostosVersionsPayload {
  'release_package_urls' : Array<string>,
  'hostos_version_to_elect' : [] | [string],
  'hostos_versions_to_unelect' : Array<string>,
  'release_package_sha256_hex' : [] | [string],
}
export type SchnorrAlgorithm = { 'ed25519' : null } |
  { 'bip340secp256k1' : null };
export interface SchnorrKeyId {
  'algorithm' : SchnorrAlgorithm,
  'name' : string,
}
export interface SetFirewallConfigPayload {
  'ipv4_prefixes' : Array<string>,
  'firewall_config' : string,
  'ipv6_prefixes' : Array<string>,
}
export interface SubnetFeatures {
  'canister_sandboxing' : boolean,
  'http_requests' : boolean,
  'sev_enabled' : [] | [boolean],
}
export type SubnetType = { 'application' : null } |
  { 'verified_application' : null } |
  { 'system' : null };
export interface UpdateApiBoundaryNodesVersionPayload {
  'version' : string,
  'node_ids' : Array<Principal>,
}
export interface UpdateElectedHostosVersionsPayload {
  'release_package_urls' : Array<string>,
  'hostos_version_to_elect' : [] | [string],
  'hostos_versions_to_unelect' : Array<string>,
  'release_package_sha256_hex' : [] | [string],
}
export interface UpdateFirewallRulesPayload {
  'expected_hash' : string,
  'scope' : FirewallRulesScope,
  'positions' : Array<number>,
  'rules' : Array<FirewallRule>,
}
export interface UpdateNodeDirectlyPayload {
  'idkg_dealing_encryption_pk' : [] | [Array<number>],
}
export interface UpdateNodeDomainDirectlyPayload {
  'node_id' : Principal,
  'domain' : [] | [string],
}
export type UpdateNodeDomainDirectlyResponse = { 'Ok' : null } |
  { 'Err' : string };
export interface UpdateNodeIPv4ConfigDirectlyPayload {
  'ipv4_config' : [] | [IPv4Config],
  'node_id' : Principal,
}
export type UpdateNodeIpv4ConfigDirectlyResponse = { 'Ok' : null } |
  { 'Err' : string };
export interface UpdateNodeOperatorConfigDirectlyPayload {
  'node_operator_id' : [] | [Principal],
  'node_provider_id' : [] | [Principal],
}
export interface UpdateNodeOperatorConfigPayload {
  'node_operator_id' : [] | [Principal],
  'set_ipv6_to_none' : [] | [boolean],
  'ipv6' : [] | [string],
  'node_provider_id' : [] | [Principal],
  'node_allowance' : [] | [bigint],
  'rewardable_nodes' : Array<[string, number]>,
  'dc_id' : [] | [string],
}
export interface UpdateNodeRewardsTableProposalPayload {
  'new_entries' : Array<[string, NodeRewardRates]>,
}
export interface UpdateNodesHostosVersionPayload {
  'hostos_version_id' : [] | [string],
  'node_ids' : Array<Principal>,
}
export interface UpdateSshReadOnlyAccessForAllUnassignedNodesPayload {
  'ssh_readonly_keys' : Array<string>,
}
export interface UpdateSubnetPayload {
  'unit_delay_millis' : [] | [bigint],
  'max_duplicity' : [] | [number],
  'features' : [] | [SubnetFeatures],
  'set_gossip_config_to_default' : boolean,
  'halt_at_cup_height' : [] | [boolean],
  'pfn_evaluation_period_ms' : [] | [number],
  'subnet_id' : Principal,
  'max_ingress_bytes_per_message' : [] | [bigint],
  'dkg_dealings_per_block' : [] | [bigint],
  'ecdsa_key_signing_disable' : [] | [Array<EcdsaKeyId>],
  'max_block_payload_size' : [] | [bigint],
  'start_as_nns' : [] | [boolean],
  'is_halted' : [] | [boolean],
  'chain_key_signing_enable' : [] | [Array<MasterPublicKeyId>],
  'max_ingress_messages_per_block' : [] | [bigint],
  'max_number_of_canisters' : [] | [bigint],
  'ecdsa_config' : [] | [EcdsaConfig],
  'retransmission_request_ms' : [] | [number],
  'dkg_interval_length' : [] | [bigint],
  'registry_poll_period_ms' : [] | [number],
  'max_chunk_wait_ms' : [] | [number],
  'receive_check_cache_size' : [] | [number],
  'ecdsa_key_signing_enable' : [] | [Array<EcdsaKeyId>],
  'ssh_backup_access' : [] | [Array<string>],
  'max_chunk_size' : [] | [number],
  'initial_notary_delay_millis' : [] | [bigint],
  'chain_key_config' : [] | [ChainKeyConfig],
  'max_artifact_streams_per_peer' : [] | [number],
  'subnet_type' : [] | [SubnetType],
  'ssh_readonly_access' : [] | [Array<string>],
  'chain_key_signing_disable' : [] | [Array<MasterPublicKeyId>],
}
export interface UpdateUnassignedNodesConfigPayload {
  'replica_version' : [] | [string],
  'ssh_readonly_access' : [] | [Array<string>],
}
export type VetKdCurve = { 'bls12_381_g2' : null };
export interface VetKdKeyId { 'name' : string, 'curve' : VetKdCurve }
export interface _SERVICE {
  'add_api_boundary_nodes' : (arg_0: AddApiBoundaryNodesPayload) => Promise<
      undefined
    >,
  'add_firewall_rules' : (arg_0: AddFirewallRulesPayload) => Promise<undefined>,
  'add_node' : (arg_0: AddNodePayload) => Promise<Principal>,
  'add_node_operator' : (arg_0: AddNodeOperatorPayload) => Promise<undefined>,
  'add_nodes_to_subnet' : (arg_0: AddNodesToSubnetPayload) => Promise<
      undefined
    >,
  'add_or_remove_data_centers' : (
      arg_0: AddOrRemoveDataCentersProposalPayload,
    ) => Promise<undefined>,
  'change_subnet_membership' : (
      arg_0: ChangeSubnetMembershipPayload,
    ) => Promise<undefined>,
  'clear_provisional_whitelist' : () => Promise<undefined>,
  'complete_canister_migration' : (
      arg_0: CompleteCanisterMigrationPayload,
    ) => Promise<undefined>,
  'create_subnet' : (arg_0: CreateSubnetPayload) => Promise<undefined>,
  'deploy_guestos_to_all_subnet_nodes' : (
      arg_0: DeployGuestosToAllSubnetNodesPayload,
    ) => Promise<undefined>,
  'deploy_guestos_to_all_unassigned_nodes' : (
      arg_0: DeployGuestosToAllUnassignedNodesPayload,
    ) => Promise<undefined>,
  'deploy_guestos_to_some_api_boundary_nodes' : (
      arg_0: DeployGuestosToSomeApiBoundaryNodes,
    ) => Promise<undefined>,
  'deploy_hostos_to_some_nodes' : (arg_0: DeployHostosToSomeNodes) => Promise<
      undefined
    >,
  'get_api_boundary_node_ids' : (
      arg_0: GetApiBoundaryNodeIdsRequest,
    ) => Promise<GetApiBoundaryNodeIdsResponse>,
  'get_build_metadata' : () => Promise<string>,
  'get_node_operators_and_dcs_of_node_provider' : (arg_0: Principal) => Promise<
      GetNodeOperatorsAndDcsOfNodeProviderResponse
    >,
  'get_node_providers_monthly_xdr_rewards' : () => Promise<
      GetNodeProvidersMonthlyXdrRewardsResponse
    >,
  'get_subnet_for_canister' : (arg_0: GetSubnetForCanisterRequest) => Promise<
      GetSubnetForCanisterResponse
    >,
  'prepare_canister_migration' : (
      arg_0: PrepareCanisterMigrationPayload,
    ) => Promise<undefined>,
  'recover_subnet' : (arg_0: RecoverSubnetPayload) => Promise<undefined>,
  'remove_api_boundary_nodes' : (
      arg_0: RemoveApiBoundaryNodesPayload,
    ) => Promise<undefined>,
  'remove_firewall_rules' : (arg_0: RemoveFirewallRulesPayload) => Promise<
      undefined
    >,
  'remove_node_directly' : (arg_0: RemoveNodeDirectlyPayload) => Promise<
      undefined
    >,
  'remove_node_operators' : (arg_0: RemoveNodeOperatorsPayload) => Promise<
      undefined
    >,
  'remove_nodes' : (arg_0: RemoveNodesPayload) => Promise<undefined>,
  'remove_nodes_from_subnet' : (arg_0: RemoveNodesPayload) => Promise<
      undefined
    >,
  'reroute_canister_ranges' : (arg_0: RerouteCanisterRangesPayload) => Promise<
      undefined
    >,
  'revise_elected_guestos_versions' : (
      arg_0: ReviseElectedGuestosVersionsPayload,
    ) => Promise<undefined>,
  'revise_elected_hostos_versions' : (
      arg_0: ReviseElectedHostosVersionsPayload,
    ) => Promise<undefined>,
  'revise_elected_replica_versions' : (
      arg_0: ReviseElectedGuestosVersionsPayload,
    ) => Promise<undefined>,
  'set_firewall_config' : (arg_0: SetFirewallConfigPayload) => Promise<
      undefined
    >,
  'update_api_boundary_nodes_version' : (
      arg_0: UpdateApiBoundaryNodesVersionPayload,
    ) => Promise<undefined>,
  'update_elected_hostos_versions' : (
      arg_0: UpdateElectedHostosVersionsPayload,
    ) => Promise<undefined>,
  'update_firewall_rules' : (arg_0: UpdateFirewallRulesPayload) => Promise<
      undefined
    >,
  'update_node_directly' : (arg_0: UpdateNodeDirectlyPayload) => Promise<
      undefined
    >,
  'update_node_domain_directly' : (
      arg_0: UpdateNodeDomainDirectlyPayload,
    ) => Promise<UpdateNodeDomainDirectlyResponse>,
  'update_node_ipv4_config_directly' : (
      arg_0: UpdateNodeIPv4ConfigDirectlyPayload,
    ) => Promise<UpdateNodeIpv4ConfigDirectlyResponse>,
  'update_node_operator_config' : (
      arg_0: UpdateNodeOperatorConfigPayload,
    ) => Promise<undefined>,
  'update_node_operator_config_directly' : (
      arg_0: UpdateNodeOperatorConfigDirectlyPayload,
    ) => Promise<undefined>,
  'update_node_rewards_table' : (
      arg_0: UpdateNodeRewardsTableProposalPayload,
    ) => Promise<undefined>,
  'update_nodes_hostos_version' : (
      arg_0: UpdateNodesHostosVersionPayload,
    ) => Promise<undefined>,
  'update_ssh_readonly_access_for_all_unassigned_nodes' : (
      arg_0: UpdateSshReadOnlyAccessForAllUnassignedNodesPayload,
    ) => Promise<undefined>,
  'update_subnet' : (arg_0: UpdateSubnetPayload) => Promise<undefined>,
  'update_unassigned_nodes_config' : (
      arg_0: UpdateUnassignedNodesConfigPayload,
    ) => Promise<undefined>,
}
