import { buildMockTxHash } from "@/lib/hashPayload";

type AnchorEventType =
  | "BUDGET_ISSUED"
  | "POLICY_SNAPSHOT"
  | "TRANSACTION_DECISION"
  | "SETTLEMENT_REPORT"
  | "POLICY_EXCEPTION_REQUEST";

export type AnchorAdapterResult = {
  chainStatus: "PENDING" | "ANCHORED" | "FAILED";
  txHash: string | null;
  anchoredAt: Date | null;
};

export interface AnchoringAdapter {
  anchor(input: {
    eventType: AnchorEventType;
    payloadHash: string;
    entityType: string;
    entityId: string;
  }): Promise<AnchorAdapterResult>;
}

class MockAnchoringAdapter implements AnchoringAdapter {
  async anchor(input: {
    eventType: AnchorEventType;
    payloadHash: string;
    entityType: string;
    entityId: string;
  }) {
    const txHash = buildMockTxHash(input.eventType, input.payloadHash);

    return {
      chainStatus: "ANCHORED" as const,
      txHash,
      anchoredAt: new Date(),
    };
  }
}

export function getAnchoringAdapter(): AnchoringAdapter {
  const adapter = process.env.ANCHOR_ADAPTER?.toLowerCase() || "mock";

  // For MVP, we only support mock adapter.
  if (adapter === "mock") {
    return new MockAnchoringAdapter();
  }

  return new MockAnchoringAdapter();
}
