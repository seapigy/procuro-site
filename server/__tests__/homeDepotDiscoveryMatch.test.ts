import { matchHomeDepotRowsToQuotes } from '../src/providers/homeDepotDiscoveryMatch';

describe('homeDepotDiscoveryMatch', () => {
  it('prefers higher title match over cheaper irrelevant product', () => {
    const rows = [
      {
        product_name: 'Random Plastic Tarp 8x10',
        manufacturer: 'Acme',
        final_price: '4.99',
        url: 'https://www.homedepot.com/p/tarp/111',
        product_id: '111111111',
      },
      {
        product_name: 'Everbilt 1-1/2 in. Stainless Finishing Nails 6 oz',
        manufacturer: 'Everbilt',
        final_price: '8.50',
        url: 'https://www.homedepot.com/p/nails/222222222',
        product_id: '222222222',
      },
    ];

    const q = matchHomeDepotRowsToQuotes(rows, {
      matchItemName: 'Everbilt 1-1/2 in stainless finishing nails 6 oz',
      discoveryQuery: 'everbilt finishing nails',
      lastPaidPrice: null,
    });

    expect(q).toHaveLength(1);
    expect(q[0].unitPrice).toBe(8.5);
    expect(String(q[0].url)).toContain('222222222');
  });

  it('among similar scores picks lower price', () => {
    const rows = [
      {
        product_name: 'Stainless Finishing Nails 6 oz',
        manufacturer: 'Everbilt',
        final_price: '12.00',
        url: 'https://www.homedepot.com/p/a/333333333',
        product_id: '333333333',
      },
      {
        product_name: 'Stainless Finishing Nails 6 oz',
        manufacturer: 'Everbilt',
        final_price: '9.00',
        url: 'https://www.homedepot.com/p/b/444444444',
        product_id: '444444444',
      },
    ];

    const q = matchHomeDepotRowsToQuotes(rows, {
      matchItemName: 'Everbilt stainless finishing nails 6 oz',
      discoveryQuery: 'everbilt nails',
      lastPaidPrice: null,
    });

    expect(q).toHaveLength(1);
    expect(q[0].unitPrice).toBe(9);
  });
});
