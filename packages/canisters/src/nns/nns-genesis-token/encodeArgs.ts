import protobuf from "protobufjs";

// =============================================================================
// Type definitions that mirror the protobuf definitions for Gtc
// =============================================================================

export interface AccountState {
  // For our purposes, we assume that AccountState has an "icpts" field.
  icpts: number;
}

export interface NeuronId {
  // Assuming NeuronId is represented as a uint64 (here as a number).
  id: number;
}

export interface Gtc {
  // The mapping from account addresses to their account state.
  accounts: { [key: string]: AccountState };
  // Total ICP allocated.
  total_alloc: number;
  // The genesis timestamp (seconds since UNIX epoch).
  genesis_timestamp_seconds: number;
  // The neuron to which GTC account owners will donate funds.
  donate_account_recipient_neuron_id?: NeuronId | null;
  // The neuron to which unclaimed accounts will forward their funds.
  forward_whitelisted_unclaimed_accounts_recipient_neuron_id?: NeuronId | null;
  // List of account addresses that are whitelisted for forwarding.
  whitelisted_accounts_to_forward: string[];
}

// =============================================================================
// Inline proto definition for the minimum subset required.
// (Normally this is replicated in your .proto file.)
// =============================================================================

const protoDefinition = `
syntax = "proto3";
package ic_nns_gtc.pb.v1;

message AccountState {
  uint32 icpts = 1;
}

message NeuronId {
  uint64 id = 1;
}

message Gtc {
  // Maps account addresses to the state of the account.
  map<string, AccountState> accounts = 1;
  // The total amount of ICP allocated by the GTC.
  uint32 total_alloc = 2;
  // The timestamp (in seconds) when the canister was initialized.
  uint64 genesis_timestamp_seconds = 3;
  // The ID of the Neuron for donations.
  NeuronId donate_account_recipient_neuron_id = 4;
  // The ID of the Neuron for forwarding whitelisted unclaimed accounts.
  NeuronId forward_whitelisted_unclaimed_accounts_recipient_neuron_id = 5;
  // The accounts that are whitelisted.
  repeated string whitelisted_accounts_to_forward = 6;
}
`;

// =============================================================================
// Load/parse the proto definitions and look up the Gtc message type.
// =============================================================================

const root = protobuf.parse(protoDefinition).root;
const GtcMessage = root.lookupType("ic_nns_gtc.pb.v1.Gtc");

/**
 * Serializes a Gtc object into a protobuf-encoded Uint8Array.
 * @param gtc - The Gtc object which should adhere to the interface.
 * @returns A Uint8Array containing the serialized protobuf message.
 */
export function serializeGtc(gtc: Gtc): Uint8Array {
  // Verify that the provided object matches the schema.
  const errMsg = GtcMessage.verify(gtc);
  if (errMsg) {
    throw Error(`Gtc payload validation failed: ${errMsg}`);
  }

  // Create a protobuf message from the plain object.
  const message = GtcMessage.create(gtc);
  // Encode and finish to get a Uint8Array.
  const buffer = GtcMessage.encode(message).finish();
  return buffer;
}

// =============================================================================
// Example usage
// =============================================================================

function main() {
  // Create an example Gtc payload.
  const exampleGtc: Gtc = {
    accounts: {
      "address1": { icpts: 150 },
      "address2": { icpts: 250 },
    },
    total_alloc: 400,
    genesis_timestamp_seconds: Math.floor(Date.now() / 1000),
    donate_account_recipient_neuron_id: { id: 123456789 },
    // You can set this to null (or leave undefined) if not used.
    forward_whitelisted_unclaimed_accounts_recipient_neuron_id: null,
    whitelisted_accounts_to_forward: ["address1", "address2"],
  };

  try {
    const serialized = serializeGtc(exampleGtc);
    console.log("Serialized Gtc payload (hex):", Buffer.from(serialized).toString("hex"));
  } catch (error) {
    console.error("Error serializing Gtc payload:", error);
  }
}

// // If running this file directly, invoke the main function.
// if (require.main === module) {
//   main();
// }
