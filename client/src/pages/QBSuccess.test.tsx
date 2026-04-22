import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QBSuccess } from './QBSuccess';

vi.mock('../context/WalkthroughContext', () => ({
  setJustConnectedFlag: vi.fn(),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/qb-success" element={<QBSuccess />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('QBSuccess fallback states', () => {
  it('renders unknown failure fallback for unclassified callback errors', () => {
    renderAt('/qb-success?success=false&error=SOMETHING_NEW&errorMessage=Unexpected');
    expect(screen.getByText('Connection needs attention')).toBeInTheDocument();
    expect(screen.getByText('Reconnect QuickBooks')).toBeInTheDocument();
  });

  it('renders success header only when success=true and no error', () => {
    renderAt('/qb-success?success=true&companyName=DemoCo&importedCount=5');
    expect(screen.getByText('QuickBooks Connected Successfully!')).toBeInTheDocument();
    expect(screen.queryByText('Connection needs attention')).not.toBeInTheDocument();
  });
});
