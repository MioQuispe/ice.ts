import { Principal } from "@dfinity/principal"
import { sha224 } from "js-sha256"
import crc from "crc"
// TODO: remove
import { Buffer } from "buffer"
import { Subaccount } from "./tokens/icrc1/interfaces"

type AccountIdentifier = string;
type SubAccount = Uint8Array;

const calculateCrc32 = (bytes: Uint8Array): Uint8Array => {
  const checksumArrayBuf = new ArrayBuffer(4)
  const view = new DataView(checksumArrayBuf)
  view.setUint32(0, crc.crc32(Buffer.from(bytes)), false)
  return Buffer.from(checksumArrayBuf)
}

const toHexString = (bytes: Uint8Array) => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "")

const E8S_PER_ICP = 100_000_000

export enum TokenSymbol {
  ICP = "ICP",
}

const asciiStringToByteArray = (text: string): Array<number> => {
  return Array.from(text).map(c => c.charCodeAt(0))
}

export const principalToAccountIdentifier = (principal: Principal, subaccount?: [] | [SubAccount]): string => {
  // Hash (sha224) the principal, the subAccount and some padding
  const padding = asciiStringToByteArray("\x0Aaccount-id")

  const shaObj = sha224.create()
  shaObj.update([...padding, ...principal.toUint8Array(), ...(subaccount?.[0] ?? Array(32).fill(0))])
  const hash = new Uint8Array(shaObj.array())

  // Prepend the checksum of the hash and convert to a hex string
  const checksum = calculateCrc32(hash)
  const bytes = new Uint8Array([...checksum, ...hash])
  return toHexString(bytes)
}

export const principalToSubAccount = (principal: Principal): SubAccount => {
  const bytes = principal.toUint8Array()
  const subAccount = new Uint8Array(32)
  subAccount[0] = bytes.length
  subAccount.set(bytes, 1)
  return subAccount
}

export const accountIdentifierToBytes = (accountIdentifier: AccountIdentifier): Uint8Array => {
  return Uint8Array.from(Buffer.from(accountIdentifier, "hex")).subarray(4)
}

// export const accountIdentifierFromBytes = (accountIdentifier: Uint8Array): AccountIdentifier => {
//   return Buffer.from(accountIdentifier).toString("hex")
// }

type AddressTypes =
  {
    principal: string
    subaccount?: [] | [Subaccount]
  } |
  {
    accountId: string
  } |
  {
    owner: Principal
    subaccount?: [] | [Subaccount]
  }

export class Account {
  #principal?: string
  #accountId?: string
  #subaccount?: [] | [Subaccount]
  #owner?: Principal

  constructor({ principal, accountId, subaccount, owner }: AddressTypes) {
    if (principal) {
      this.#principal = principal
      this.#subaccount = subaccount ?? []
      this.#accountId = principalToAccountIdentifier(Principal.fromText(principal), this.#subaccount)
      this.#owner = Principal.fromText(principal)
    } else if (accountId) {
      this.#accountId = accountId
      this.#principal = principal ?? undefined
      this.#subaccount = [accountIdentifierToBytes(accountId)]
      this.#owner = principal ?? undefined
    } else if (owner) {
      this.#owner = owner
      this.#subaccount = subaccount ?? []
      this.#accountId = principalToAccountIdentifier(owner, this.#subaccount)
      this.#principal = owner.toText()
    } else {
      // TODO: if nothing passed...?
      throw new Error("no address types passed to Account constructor")
    }
    // this.#principal = principal
    // this.#subaccount =
  }

  get principal() {
    return this.#principal
  }

  get accountId() {
    return this.#accountId
  }

  get subaccount() {
    return this.#subaccount
  }

  get owner() {
    return this.#owner
  }
}
