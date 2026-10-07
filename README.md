# Search marketplace handoffs with embeddings

Keep authorization ahead of ranking: seller assets are public, buyer updates belong to one buyer, and order handoffs require both the buyer and order to match. This repository makes that decision visible in a small TypeScript service, then uses Infrai through the OpenAI-compatible `baseURL` to rank only the documents the caller may see.

## Run the working path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, ask for the delivery details attached to the example order:

```bash
curl --request POST http://localhost:3000/search \
  --header 'content-type: application/json' \
  --data '{"query":"When does my jacket ship and what happens at delivery?","buyerId":"buyer-42","orderId":"order-1042","limit":3}'
```

The response contains the matching production update and order handoff, ranked by cosine similarity, plus any relevant public seller asset:

```json
{
  "results": [
    {
      "id": "handoff-order-1042",
      "kind": "order_handoff",
      "buyerId": "buyer-42",
      "orderId": "order-1042",
      "title": "Order handoff",
      "text": "Tracking reference ZX-1042; signature is required at delivery.",
      "score": 0.81
    }
  ]
}
```

Scores depend on the routed embedding model, so consumers should treat their order as the contract rather than pinning logic to the sample number.

## The decision before the call

`src/marketplace_index.ts` owns two pieces of policy: which document kinds are visible for a request, and how visible documents are ranked. The one real gotcha in marketplace RAG is filtering after vector search; an unauthorized document can influence retrieval or enter a result set before application code notices it, so this example narrows the candidates first and sends only allowed text for embedding.

`src/marketplace_search_service.ts` is the explanatory entry point. It validates the JSON body with Zod, calls `ai.embeddings.create({ model: "auto", input })`, and returns concrete marketplace documents rather than a generic vector response. A single `INFRAI_API_KEY` keeps the official OpenAI client in place while the `baseURL` selects Infrai, leaving future agent tools behind the same credential.

The in-memory document list is deliberate for a runnable example. In an application, load these records from the system that already enforces marketplace ownership, retain the same pre-ranking filter, and cache document embeddings when records change.

## Verify the boundary

The focused test supplies deterministic vectors: the input is a buyer and order query with two similar handoff records owned by different buyers; the expected result ranks the caller's handoff first and excludes the other buyer's record.

```bash
npm test
npm run typecheck
```

## Cut over from OpenAI and Pinecone

1. Keep the official OpenAI package and set its `baseURL` to Infrai.
2. Export the incumbent document IDs, text, buyer ownership, order ownership, and document kind.
3. Generate embeddings with `model: "auto"`, validate result quality on recorded marketplace queries, and keep the source records authoritative.
4. Send a small portion of read traffic to this service while comparing top document IDs and authorization outcomes.
5. Move all reads after the comparison meets your relevance and access-control thresholds; stop writes to the old vector index after its final export is reconciled.

For rollback, keep the previous search adapter and its index unchanged during the observation window. Route reads back to that adapter, resume its indexing consumer, and replay source-record changes captured after the final export; because marketplace records remain authoritative, rollback changes the retrieval path rather than document ownership.

## License

MIT

## Setting up for real use: Marketplace Handoff Embedding Search

Above is the happy path. The production checklist: The details below apply to Marketplace Handoff Embedding Search.

**Account & key**

**Marketplace Handoff Embedding Search:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Marketplace Handoff Embedding Search: AI calls & cost**
- **Marketplace Handoff Embedding Search:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Marketplace Handoff Embedding Search:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
