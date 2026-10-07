import assert from "node:assert/strict";
import test from "node:test";
import {
  searchMarketplaceDocuments,
  type MarketplaceDocument,
} from "../src/marketplace_index.ts";

test("ranks the current order handoff without exposing another buyer's handoff", async () => {
  const documents: MarketplaceDocument[] = [
    {
      id: "public-guide",
      kind: "seller_asset",
      title: "Delivery guide",
      text: "General delivery instructions",
    },
    {
      id: "buyer-42-handoff",
      kind: "order_handoff",
      buyerId: "buyer-42",
      orderId: "order-1042",
      title: "Tracking details",
      text: "Signature required",
    },
    {
      id: "buyer-9-handoff",
      kind: "order_handoff",
      buyerId: "buyer-9",
      orderId: "order-9000",
      title: "Tracking details",
      text: "Private delivery note",
    },
  ];

  const embedTexts = async (texts: string[]): Promise<number[][]> =>
    texts.map((text) => text.includes("Tracking") || text.includes("Where") ? [1, 0] : [0, 1]);

  const results = await searchMarketplaceDocuments(
    documents,
    "Where is my order?",
    { buyerId: "buyer-42", orderId: "order-1042" },
    5,
    embedTexts,
  );

  assert.deepEqual(results.map((result) => result.id), ["buyer-42-handoff", "public-guide"]);
  assert.equal(results.some((result) => result.id === "buyer-9-handoff"), false);
});
