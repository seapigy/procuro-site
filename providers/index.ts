import { WalmartProvider } from "./walmart";
import { TargetProvider } from "./target";

// Later we add AmazonProvider when unlocked
// import { AmazonProvider } from "./amazon";

export { WalmartProvider } from "./walmart";
export { TargetProvider } from "./target";

export async function getBestPriceForItem(item: { name: string }) {
  const results = await Promise.all([
    WalmartProvider.getPriceByName(item.name),
    TargetProvider.getPriceByName(item.name),
    // AmazonProvider.getPriceByName(item.name)  (after PA-API unlock)
  ]);

  const valid = results.filter(r => r && r.price !== null);

  if (valid.length === 0) return null;

  // Sort by lowest price
  const best = valid.sort((a, b) => a.price! - b.price!)[0];

  return best;
}
