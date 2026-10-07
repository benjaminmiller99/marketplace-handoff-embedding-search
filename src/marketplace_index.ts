export type MarketplaceDocument = {
  id: string;
  kind: "seller_asset" | "buyer_update" | "order_handoff";
  title: string;
  text: string;
  buyerId?: string;
  orderId?: string;
};

export type SearchContext = {
  buyerId: string;
  orderId?: string;
};

export type SearchResult = MarketplaceDocument & { score: number };

export type EmbedTexts = (texts: string[]) => Promise<number[][]>;

function isVisible(document: MarketplaceDocument, context: SearchContext): boolean {
  if (document.kind === "seller_asset") return true;
  if (document.buyerId !== context.buyerId) return false;
  if (document.kind === "order_handoff") return document.orderId === context.orderId;
  return document.orderId === undefined || document.orderId === context.orderId;
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    throw new Error("Embedding dimensions must match");
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator === 0 ? 0 : dot / denominator;
}

export async function searchMarketplaceDocuments(
  documents: MarketplaceDocument[],
  query: string,
  context: SearchContext,
  limit: number,
  embedTexts: EmbedTexts,
): Promise<SearchResult[]> {
  const visibleDocuments = documents.filter((document) => isVisible(document, context));
  if (visibleDocuments.length === 0) return [];

  const inputs = [query].concat(
    visibleDocuments.map((document) => `${document.title}\n${document.text}`),
  );
  const vectors = await embedTexts(inputs);
  const queryVector = vectors[0];
  if (!queryVector || vectors.length !== inputs.length) {
    throw new Error("Embedding response did not match the requested inputs");
  }

  return visibleDocuments
    .map((document, index) => {
      const documentVector = vectors[index + 1];
      if (!documentVector) throw new Error("Missing document embedding");
      return Object.assign({}, document, {
        score: cosineSimilarity(queryVector, documentVector),
      });
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
