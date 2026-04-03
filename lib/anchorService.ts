import { createHash } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client";

export type AnchorEventType =
  | "BUDGET_ISSUED"
  | "POLICY_SNAPSHOT"
  | "TRANSACTION_DECISION"
  | "SETTLEMENT_REPORT";

export type AnchorEntityType =
  | "BUDGET"
  | "POLICY"
  | "TRANSACTION"
  | "SETTLEMENT";

type AnchorPayload = Record<string, unknown>;

type AnchorInput = {
  eventType: AnchorEventType;
  entityType: AnchorEntityType;
  entityId: string;
  payload: AnchorPayload;
};

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

export function buildPayloadHash(payload: AnchorPayload) {
  const canonicalPayload = JSON.stringify(canonicalize(payload));
  return createHash("sha256").update(canonicalPayload).digest("hex");
}

export function buildMockTxHash(eventType: AnchorEventType, payloadHash: string) {
  return `0x${createHash("sha256")
    .update(`${eventType}:${payloadHash}`)
    .digest("hex")
    .slice(0, 64)}`;
}

export async function createAnchorRecord(
  client: PrismaClient,
  input: AnchorInput
) {
  const payloadHash = buildPayloadHash(input.payload);
  const txHash = buildMockTxHash(input.eventType, payloadHash);

  return client.anchorRecord.create({
    data: {
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payloadHash,
      chainStatus: "ANCHORED",
      txHash,
      anchoredAt: new Date(),
    },
  });
}
