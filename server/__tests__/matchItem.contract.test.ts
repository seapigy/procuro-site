import { matchItemToRetailers } from '../src/services/matchItem';
import * as amazonBd from '../src/providers/amazonBrightDataProvider';

jest.mock('../src/config/brightData', () => ({
  getBrightDataConfig: () => ({
    enabled: true,
    apiKey: 'test-key',
    amazonDatasetId: 'test-dataset',
    amazonSearchDatasetId: '',
    homeDepotDatasetId: '',
  }),
}));

jest.mock('../src/providers/amazonBrightDataProvider', () => ({
  getAmazonDiscoveryQuotesWithStats: jest.fn(),
}));

const mockGetAmazonDiscovery = amazonBd.getAmazonDiscoveryQuotesWithStats as jest.MockedFunction<
  typeof amazonBd.getAmazonDiscoveryQuotesWithStats
>;

describe('matchItemToRetailers contract (Amazon only)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when Amazon discovery returns no quotes', async () => {
    mockGetAmazonDiscovery.mockResolvedValue({
      quotes: [],
      rawRowsReturned: 0,
      rowsAfterProductFilter: 0,
      normalizedRows: 0,
      cacheHit: false,
      emptyReason: 'no rows',
      discoveryKeyword: 'test',
    });

    const result = await matchItemToRetailers('Commander 42 Gallon Trash Bags', 19, false);
    expect(result).toBeNull();
  });

  it('returns Amazon candidate details with non-null confidence when quotes exist', async () => {
    const title = 'Commander 42 Gallon 2.5 MIL Black Heavy Duty Garbage Trash Bags - Pack of 20';
    mockGetAmazonDiscovery.mockResolvedValue({
      quotes: [
        {
          retailer: 'Amazon',
          url: 'https://www.amazon.com/dp/B0TEST1234',
          unitPrice: 18.99,
          currency: 'USD',
          rawJson: { title, asin: 'B0TEST1234' },
        },
      ],
      rawRowsReturned: 5,
      rowsAfterProductFilter: 5,
      normalizedRows: 5,
      cacheHit: false,
      discoveryKeyword: 'commander 42 gallon',
    });

    const result = await matchItemToRetailers(title, 19, false);
    expect(result).not.toBeNull();
    expect(result?.retailer).toBe('amazon');
    expect(result?.url).toBe('https://www.amazon.com/dp/B0TEST1234');
    expect(result?.title).toBe(title);
    expect(result?.confidence).not.toBeNull();
    expect((result?.confidence ?? 0)).toBeGreaterThan(0);
  });
});
