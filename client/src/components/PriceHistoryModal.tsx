import { useState, useEffect } from 'react';
import { Modal } from './ui/modal';
import { LoadingState } from './ui/spinner';
import { apiUrl, apiFetch } from '../utils/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PriceHistoryData {
  date: string;
  price: number;
  retailer: string;
}

interface PriceHistoryResponse {
  success: boolean;
  itemId: number;
  bestPrice30Days: number | null;
  avgPrice30Days: number | null;
  history: PriceHistoryData[];
}

interface PriceHistoryModalProps {
  itemId: number | null;
  itemName?: string;
  onClose: () => void;
}

export function PriceHistoryModal({ itemId, itemName, onClose }: PriceHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PriceHistoryResponse | null>(null);

  useEffect(() => {
    if (!itemId) return;

    const fetchPriceHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await apiFetch(apiUrl(`/api/items/${itemId}/price-history`));

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage = errorData.details || errorData.message || errorData.error || 'Failed to fetch price history';
          throw new Error(errorMessage);
        }

        const responseData: PriceHistoryResponse = await res.json();
        setData(responseData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Price history fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPriceHistory();
  }, [itemId]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    }).format(date);
  };

  // Prepare chart data
  const chartData = data?.history.map((h) => ({
    name: formatDate(h.date),
    price: h.price,
    fullDate: h.date,
    retailer: h.retailer,
  })) || [];

  return (
    <Modal
      isOpen={itemId !== null}
      onClose={onClose}
      title={`Price History${itemName ? ` — ${itemName}` : ''}`}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {loading && (
          <div className="py-8">
            <LoadingState />
          </div>
        )}

        {error && (
          <div className="py-8 px-4">
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-red-800 dark:text-red-200 font-medium mb-2">Error Loading Price History</p>
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">{error}</p>
              {error.includes('table does not exist') || error.includes('migration') ? (
                <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-800">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">To fix this:</p>
                  <ol className="text-xs text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
                    <li>Stop the backend server</li>
                    <li>Run: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">cd server && npx prisma migrate dev --name add_price_history</code></li>
                    <li>Run: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">npx prisma generate</code></li>
                    <li>Restart the backend server</li>
                  </ol>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground mb-1">Best Price (30 Days)</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {data.bestPrice30Days ? formatPrice(data.bestPrice30Days) : 'N/A'}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground mb-1">Average Price (30 Days)</div>
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {data.avgPrice30Days ? formatPrice(data.avgPrice30Days) : 'N/A'}
                </div>
              </div>
            </div>

            {data.history.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No price history yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Price history will appear here after prices are checked.
                </p>
              </div>
            ) : (
              <>
                {/* Chart */}
                {chartData.length > 0 && (
                  <div className="rounded-lg border p-4">
                    <h3 className="text-sm font-medium mb-4">Price Trend (Last 30 Days)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `$${value.toFixed(2)}`}
                        />
                        <Tooltip
                          formatter={(value: number) => formatPrice(value)}
                          labelFormatter={(label, payload) => {
                            if (payload && payload[0]) {
                              const data = payload[0].payload;
                              return `${data.fullDate ? formatDate(data.fullDate) : label} (${data.retailer})`;
                            }
                            return label;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Table */}
                <div className="rounded-lg border">
                  <div className="px-4 py-3 border-b">
                    <h3 className="text-sm font-medium">Price History Details</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                            Retailer
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                            Price
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.history.map((entry, index) => (
                          <tr key={index} className="hover:bg-muted/50">
                            <td className="px-4 py-3 text-sm">{formatDate(entry.date)}</td>
                            <td className="px-4 py-3 text-sm">{entry.retailer}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium">
                              {formatPrice(entry.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
