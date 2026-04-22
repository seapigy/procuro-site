/**
 * Seed definitions for TEST_MODE Amazon live batch: 20 home-cleaning–style product search phrases.
 * Stored as Item rows tagged with AMAZON_TEST_CLEANING_CATEGORY for idempotent upsert.
 */

export const AMAZON_TEST_CLEANING_CATEGORY = 'amazon_test_cleaning';

export interface AmazonTestCleaningSeedRow {
  /** Stable id for upsert (01–20) */
  sku: string;
  /** Amazon / discovery search phrase */
  name: string;
  /** Required Item.lastPaidPrice — placeholder for matcher reference */
  lastPaidPrice: number;
}

export const AMAZON_TEST_CLEANING_ITEMS: AmazonTestCleaningSeedRow[] = [
  { sku: 'AMAZON_TEST_CLEANING_01', name: 'microfiber cleaning cloths pack 24', lastPaidPrice: 14.99 },
  { sku: 'AMAZON_TEST_CLEANING_02', name: 'wet mop refills disposable', lastPaidPrice: 19.49 },
  { sku: 'AMAZON_TEST_CLEANING_03', name: 'glass cleaner spray bottle', lastPaidPrice: 4.29 },
  { sku: 'AMAZON_TEST_CLEANING_04', name: 'vacuum cleaner bags HEPA universal', lastPaidPrice: 12.99 },
  { sku: 'AMAZON_TEST_CLEANING_05', name: 'toilet bowl cleaner gel', lastPaidPrice: 3.79 },
  { sku: 'AMAZON_TEST_CLEANING_06', name: 'disinfecting wipes bulk canister', lastPaidPrice: 8.99 },
  { sku: 'AMAZON_TEST_CLEANING_07', name: 'nitrile disposable gloves medium box', lastPaidPrice: 11.49 },
  { sku: 'AMAZON_TEST_CLEANING_08', name: 'window squeegee rubber blade', lastPaidPrice: 9.99 },
  { sku: 'AMAZON_TEST_CLEANING_09', name: 'broom and dustpan set', lastPaidPrice: 15.99 },
  { sku: 'AMAZON_TEST_CLEANING_10', name: 'paper towels 12 pack', lastPaidPrice: 22.99 },
  { sku: 'AMAZON_TEST_CLEANING_11', name: 'all purpose cleaner concentrate', lastPaidPrice: 7.49 },
  { sku: 'AMAZON_TEST_CLEANING_12', name: 'floor polish restorer hardwood', lastPaidPrice: 16.49 },
  { sku: 'AMAZON_TEST_CLEANING_13', name: 'grout brush stiff nylon', lastPaidPrice: 6.29 },
  { sku: 'AMAZON_TEST_CLEANING_14', name: 'commercial trash bags 55 gallon', lastPaidPrice: 28.99 },
  { sku: 'AMAZON_TEST_CLEANING_15', name: 'room odor eliminator spray', lastPaidPrice: 5.99 },
  { sku: 'AMAZON_TEST_CLEANING_16', name: 'extendable microfiber duster', lastPaidPrice: 13.49 },
  { sku: 'AMAZON_TEST_CLEANING_17', name: 'heavy duty scrub sponges 6 pack', lastPaidPrice: 8.49 },
  { sku: 'AMAZON_TEST_CLEANING_18', name: 'steel wool soap pads', lastPaidPrice: 4.99 },
  { sku: 'AMAZON_TEST_CLEANING_19', name: 'cleaning bucket 3.5 gallon', lastPaidPrice: 7.99 },
  { sku: 'AMAZON_TEST_CLEANING_20', name: 'pumice stone toilet ring remover', lastPaidPrice: 5.49 },
];

export const AMAZON_TEST_CLEANING_EXPECTED_COUNT = AMAZON_TEST_CLEANING_ITEMS.length;
