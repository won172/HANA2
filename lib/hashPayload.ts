import { createHash } from "node:crypto";

type AnchorPayload = Record<string, unknown>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = canonicalize(
          (value as Record<string, unknown>)[key]
        );
        return accumulator;
      }, {});
  }

  return value;
}

export function hashPayload(payload: AnchorPayload) {
  const canonicalPayload = JSON.stringify(canonicalize(payload));
  return createHash("sha256").update(canonicalPayload).digest("hex");
}

export function buildMockTxHash(eventType: string, payloadHash: string) {
  return `0x${createHash("sha256")
    .update(`${eventType}:${payloadHash}`)
    .digest("hex")
    .slice(0, 64)}`;
}
