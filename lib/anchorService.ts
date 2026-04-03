import type { PrismaClient } from "../generated/prisma/client";
import { getAnchoringAdapter } from "@/lib/anchorAdapter";
import { hashPayload } from "@/lib/hashPayload";

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
  return hashPayload(canonicalize(payload) as AnchorPayload);
}

export function buildMockTxHash(eventType: AnchorEventType, payloadHash: string) {
  return `mock:${eventType}:${payloadHash.slice(0, 12)}`;
}

export async function createAnchorRecord(
  client: PrismaClient,
  input: AnchorInput
) {
  const payloadHash = buildPayloadHash(input.payload);
  const adapter = getAnchoringAdapter();
  const anchored = await adapter.anchor({
    eventType: input.eventType,
    payloadHash,
    entityType: input.entityType,
    entityId: input.entityId,
  });

  return client.anchorRecord.create({
    data: {
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payloadHash,
      chainStatus: anchored.chainStatus,
      txHash: anchored.txHash,
      anchoredAt: anchored.anchoredAt,
    },
  });
}
