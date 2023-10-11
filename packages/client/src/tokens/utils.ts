import { Principal } from "@dfinity/principal"
import CryptoJS from "crypto-js"
import crc32 from "buffer-crc32"
// TODO: remove
import { Buffer } from "buffer/"

const ACCOUNT_DOMAIN_SEPERATOR = "\x0Aaccount-id"
const SUB_ACCOUNT_ZERO = Buffer.alloc(32)

export const NFT_CANISTERS = {
  WRAPPED_PUNKS: "bxdf4-baaaa-aaaah-qaruq-cai",
  WRAPPED_DRIP: "3db6u-aiaaa-aaaah-qbjbq-cai",
  IC_PUNKS: "qcg3w-tyaaa-aaaah-qakea-cai",
  IC_DRIP: "d3ttm-qaaaa-aaaai-qam4a-cai",
  ICP_BUNNY_MAIN: "xkbqi-2qaaa-aaaah-qbpqq-cai",
  ICP_BUNNY_STORAGE: [
    "efqhu-yqaaa-aaaaf-qaeda-cai",
    "ecrba-viaaa-aaaaf-qaedq-cai",
    "fp7fo-2aaaa-aaaaf-qaeea-cai",
    "fi6d2-xyaaa-aaaaf-qaeeq-cai",
    "fb5ig-bqaaa-aaaaf-qaefa-cai",
    "fg4os-miaaa-aaaaf-qaefq-cai",
    "ft377-naaaa-aaaaf-qaega-cai",
    "fu2zl-ayaaa-aaaaf-qaegq-cai",
    "f5zsx-wqaaa-aaaaf-qaeha-cai",
    "f2yud-3iaaa-aaaaf-qaehq-cai",
  ],
}


/* eslint-disable prefer-template */
/* eslint-disable no-bitwise */
export const to32bits = (num: number): any => {
  const b = new ArrayBuffer(4)
  new DataView(b).setUint32(0, num)
  return Array.from(new Uint8Array(b))
}

export const from32bits = (ba: any): any => {
  let value
  for (let i = 0; i < 4; i += 1) {
    value = (value << 8) | ba[i]
  }
  return value
}


const byteArrayToWordArray = (byteArray: Uint8Array) => {
  const wordArray = [] as any
  let i
  for (i = 0; i < byteArray.length; i += 1) {
    wordArray[(i / 4) | 0] |= byteArray[i] << (24 - 8 * i)
  }
  // eslint-disable-next-line
  const result = CryptoJS.lib.WordArray.create(wordArray, byteArray.length)
  return result
}

const wordToByteArray = (word, length): number[] => {
  const byteArray: number[] = []
  const xFF = 0xff
  if (length > 0) byteArray.push(word >>> 24)
  if (length > 1) byteArray.push((word >>> 16) & xFF)
  if (length > 2) byteArray.push((word >>> 8) & xFF)
  if (length > 3) byteArray.push(word & xFF)

  return byteArray
}

const wordArrayToByteArray = (wordArray, length) => {
  if (wordArray.hasOwnProperty("sigBytes") && wordArray.hasOwnProperty("words")) {
    length = wordArray.sigBytes
    wordArray = wordArray.words
  }

  let result: number[] = []
  let bytes
  let i = 0
  while (length > 0) {
    bytes = wordToByteArray(wordArray[i], Math.min(4, length))
    length -= bytes.length
    result = [...result, bytes]
    i++
  }
  // @ts-ignore
  return [].concat.apply([], result)
}

const intToHex = (val: number) => (val < 0 ? (Number(val) >>> 0).toString(16) : Number(val).toString(16))

// We generate a CRC32 checksum, and trnasform it into a hexString
const generateChecksum = (hash: Uint8Array) => {
  const crc = crc32.unsigned(Buffer.from(hash))
  const hex = intToHex(crc)
  return hex.padStart(8, "0")
}

/*
    Used dfinity/keysmith/account/account.go as a base for the ID generation
*/
export const getAccountId = (principal: Principal, subAccount?: number): string => {
  const sha = CryptoJS.algo.SHA224.create()
  sha.update(ACCOUNT_DOMAIN_SEPERATOR) // Internally parsed with UTF-8, like go does
  sha.update(byteArrayToWordArray(principal.toUint8Array()))
  const subBuffer = Buffer.from(SUB_ACCOUNT_ZERO)
  if (subAccount) {
    subBuffer.writeUInt32BE(subAccount)
  }
  sha.update(byteArrayToWordArray(subBuffer))
  const hash = sha.finalize()

  /// While this is backed by an array of length 28, it's canonical representation
  /// is a hex string of length 64. The first 8 characters are the CRC-32 encoded
  /// hash of the following 56 characters of hex. Both, upper and lower case
  /// characters are valid in the input string and can even be mixed.
  /// [ic/rs/rosetta-api/ledger_canister/src/account_identifier.rs]
  const byteArray = wordArrayToByteArray(hash, 28)
  // @ts-ignore
  const checksum = generateChecksum(byteArray)
  const val = checksum + hash.toString()

  return val
}

export const CANISTER_MAX_LENGTH = 27
export const PRINCIPAL_REGEX = /(\w{5}-){10}\w{3}/
export const ALPHANUM_REGEX = /^[a-zA-Z0-9]+$/

export const isValidPrincipal = (text: string): boolean => Principal.fromText(text).toText() === text

export const validatePrincipalId = (text: string): boolean => {
  try {
    return Boolean(PRINCIPAL_REGEX.test(text) && isValidPrincipal(text))
  } catch (e) {
    return false
  }
}
export const validateAccountId = (text): boolean => text.length === 64 && ALPHANUM_REGEX.test(text)
export const validateCanisterId = (text: string): boolean => {
  try {
    return Boolean(text.length <= CANISTER_MAX_LENGTH && isValidPrincipal(text))
  } catch (e) {
    return false
  }
}

export const validateToken = (metadata: any): boolean => Boolean(!!metadata.decimal && !!metadata.name && !!metadata.symbol)

export default {}
