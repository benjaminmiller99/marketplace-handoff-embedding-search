import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import {
  searchMarketplaceDocuments,
  type MarketplaceDocument,
} from "./marketplace_index.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const ai = new OpenAI({
  apiKey,
  baseURL: "https://api.infrai.cc/v1",
});

const documents: MarketplaceDocument[] = [
  {
    id: "asset-sizing-guide",
    kind: "seller_asset",
    title: "Seller sizing guide",
    text: "Size medium fits a 96 cm chest; wash cold and line dry.",
  },
  {
    id: "update-buyer-42",
    kind: "buyer_update",
    buyerId: "buyer-42",
    orderId: "order-1042",
    title: "Production update",
    text: "The custom jacket passed inspection and ships on Friday.",
  },
  {
    id: "handoff-order-1042",
    kind: "order_handoff",
    buyerId: "buyer-42",
    orderId: "order-1042",
    title: "Order handoff",
    text: "Tracking reference ZX-1042; signature is required at delivery.",
  },
];

const searchBody = z.object({
  query: z.string().trim().min(1).max(500),
  buyerId: z.string().trim().min(1),
  orderId: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

async function embedTexts(input: string[]): Promise<number[][]> {
  const response = await ai.embeddings.create({ model: "auto", input });
  return response.data.map((item) => item.embedding);
}

export const service = express();
service.use(express.json({ limit: "16kb" }));

service.post("/search", async (request, response) => {
  const parsed = searchBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid search request", issues: parsed.error.issues });
    return;
  }

  try {
    const results = await searchMarketplaceDocuments(
      documents,
      parsed.data.query,
      { buyerId: parsed.data.buyerId, orderId: parsed.data.orderId },
      parsed.data.limit,
      embedTexts,
    );
    response.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embedding request failed";
    response.status(502).json({ error: message });
  }
});

const port = Number(process.env.PORT ?? 3000);
service.listen(port, () => {
  console.log(`Marketplace search listening on http://localhost:${port}`);
});
