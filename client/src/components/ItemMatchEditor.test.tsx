import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemMatchEditor } from './ItemMatchEditor';

const baseItem = {
  id: 101,
  name: 'Commander 42 Gallon 2.5 MIL Black Heavy Duty Garbage Trash Bags',
  vendorName: 'Generic Supplier',
  category: 'Facility',
  baselinePrice: 18,
  lastPaidPrice: 19,
  matchedRetailer: null,
  matchedUrl: null,
  matchedPrice: null,
  matchConfidence: null,
  matchStatus: 'unmatched',
  isManuallyMatched: false,
  matchProvider: null,
  matchUrl: null,
  matchTitle: null,
  matchReasons: null,
  manualMatchProvider: null,
  manualMatchUrl: null,
  manualMatchTitle: null,
  lastMatchedAt: null,
};

describe('ItemMatchEditor evidence rendering', () => {
  it('shows no-match state when unmatched and no concrete evidence', () => {
    render(
      <ItemMatchEditor
        isOpen
        onClose={vi.fn()}
        item={baseItem}
      />
    );

    expect(screen.getByText('No match found')).toBeInTheDocument();
    expect(screen.queryByText('Best Current Match')).not.toBeInTheDocument();
  });

  it('shows best match panel when there is low-confidence concrete evidence', () => {
    render(
      <ItemMatchEditor
        isOpen
        onClose={vi.fn()}
        item={{
          ...baseItem,
          matchStatus: 'needs_review',
          matchProvider: 'homedepot',
          matchUrl: 'https://www.homedepot.com/p/commander-bags/123456789',
          matchTitle: 'Commander 42 Gallon 2.5 MIL Black Heavy Duty Garbage Trash Bags - Pack of 20',
          matchedUrl: 'https://www.homedepot.com/p/commander-bags/123456789',
          matchedRetailer: 'Home Depot',
          matchConfidence: 0.3,
        }}
      />
    );

    expect(screen.getByText('Best Current Match')).toBeInTheDocument();
    expect(screen.getByText(/30% \(Low confidence\)/i)).toBeInTheDocument();
    expect(screen.queryByText('No match found')).not.toBeInTheDocument();
  });
});
