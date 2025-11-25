import * as cheerio from "cheerio";

export interface ParsedRetailerResult {
  retailer: string;
  title: string | null;
  price: number | null;
  url: string | null;
  image: string | null;
  stock: boolean | null;
}

export function parseWalmartHtml(html: string): ParsedRetailerResult {
  try {
    const $ = cheerio.load(html);

    // Walmart embeds ALL product data in __NEXT_DATA__ JSON
    const script = $("#__NEXT_DATA__").html();
    if (!script) {
      return {
        retailer: "Walmart",
        title: null,
        price: null,
        url: null,
        image: null,
        stock: null
      };
    }

    const json = JSON.parse(script);

    // Path to product data - try multiple paths for search results
    const product =
      json?.props?.pageProps?.initialData?.data?.product?.item ||
      json?.props?.pageProps?.initialData?.searchResult?.itemStacks?.[0]?.items?.[0] ||
      json?.props?.pageProps?.initialData?.searchResult?.items?.[0] ||
      json?.props?.pageProps?.initialData?.data?.searchResult?.itemStacks?.[0]?.items?.[0];

    if (!product) {
      return {
        retailer: "Walmart",
        title: null,
        price: null,
        url: null,
        image: null,
        stock: null
      };
    }

    const title = product?.productName || product?.title || product?.name || null;

    const price =
      product?.primaryOffer?.offerPrice ||
      product?.priceInfo?.currentPrice?.price ||
      product?.price?.currentPrice?.price ||
      product?.price ||
      null;

    const image =
      product?.imageInfo?.thumbnailUrl ||
      product?.imageInfo?.allImages?.[0]?.url ||
      product?.image?.thumbnailUrl ||
      product?.image ||
      null;

    const productId = product?.usItemId || product?.itemId || product?.id || null;

    const url = productId ? `https://www.walmart.com/ip/${productId}` : null;

    const stock =
      product?.availabilityStatus === "IN_STOCK" ||
      product?.availability?.type === "IN_STOCK" ||
      product?.availabilityStatusV2?.value === "IN_STOCK" ||
      product?.availabilityStatusV2?.display === "In stock" ||
      false;

    return {
      retailer: "Walmart",
      title,
      price: price ? parseFloat(String(price).replace(/[$,]/g, '')) : null,
      url,
      image,
      stock
    };
  } catch (err) {
    console.error('Walmart parser error:', err);
    return {
      retailer: "Walmart",
      title: null,
      price: null,
      url: null,
      image: null,
      stock: null
    };
  }
}

