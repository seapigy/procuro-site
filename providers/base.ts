/**
 * Base interface for retailer price providers
 */
export interface PriceProvider {
  getPrice(productId: string): Promise<PriceData>;
  getProductInfo(productId: string): Promise<ProductInfo>;
}

export interface PriceData {
  productId: string;
  price: number;
  currency: string;
  availability: boolean;
  lastUpdated: Date;
}

export interface ProductInfo {
  productId: string;
  title: string;
  imageUrl?: string;
  url: string;
  price: number;
  currency: string;
}

export abstract class BaseProvider implements PriceProvider {
  abstract getPrice(productId: string): Promise<PriceData>;
  abstract getProductInfo(productId: string): Promise<ProductInfo>;
}





