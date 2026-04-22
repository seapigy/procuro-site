import { getRetailerVisibility } from '../src/services/retailerSearchPolicy';

describe('retailerSearchPolicy', () => {
  it('defaults to both retailers for generic tool', () => {
    const v = getRetailerVisibility({ name: 'DEWALT 20V Drill', category: 'Tools' });
    expect(v.amazon).toBe(true);
    expect(v.homeDepot).toBe(true);
    expect(v.prefersHomeDepotFirst).toBe(false);
  });

  it('excludes Home Depot for ink cartridge', () => {
    const v = getRetailerVisibility({
      name: 'HP 962XL Black Ink Cartridge',
      category: 'Office Supplies',
    });
    expect(v.amazon).toBe(true);
    expect(v.homeDepot).toBe(false);
  });

  it('excludes Amazon for 2x4 lumber', () => {
    const v = getRetailerVisibility({
      name: '2 in. x 4 in. x 8 ft. SPF Stud',
      category: 'Building Materials',
    });
    expect(v.amazon).toBe(false);
    expect(v.homeDepot).toBe(true);
    expect(v.prefersHomeDepotFirst).toBe(false);
  });

  it('prefer Home Depot first for soft structural name (PEX)', () => {
    const v = getRetailerVisibility({
      name: 'PEX Pipe 1/2 in. x 50 ft. Red',
      category: null,
    });
    expect(v.amazon).toBe(true);
    expect(v.homeDepot).toBe(true);
    expect(v.prefersHomeDepotFirst).toBe(true);
  });

  it('prefer Home Depot first for plumbing category', () => {
    const v = getRetailerVisibility({
      name: 'Ball valve brass 3/4 inch',
      category: 'Plumbing',
    });
    expect(v.amazon).toBe(true);
    expect(v.homeDepot).toBe(true);
    expect(v.prefersHomeDepotFirst).toBe(true);
  });

  it('fail-opens when both would be excluded', () => {
    const v = getRetailerVisibility({
      name: 'HP Ink Cartridge 2x4 display model',
      category: 'Office Supplies',
    });
    expect(v.amazon).toBe(true);
    expect(v.homeDepot).toBe(true);
    expect(v.prefersHomeDepotFirst).toBe(false);
    expect(v.reason).toContain('fail_open');
  });
});
