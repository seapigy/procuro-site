import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { UpgradeModalProvider } from './components/UpgradeModalProvider';
import { GuideProvider } from './context/GuideContext';
import { Dashboard } from './components/Dashboard';
import { Items } from './components/Items';
import { QuickBooksShell } from './layouts/QuickBooksShell';
import { ActivationRouter } from './pages/ActivationRouter';
import { ProviderTest } from './pages/ProviderTest';
import { QA } from './pages/QA';
import { TestAdmin } from './pages/TestAdmin';
import { QBSuccess } from './pages/QBSuccess';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="procuro-ui-theme">
      <SubscriptionProvider>
        <UpgradeModalProvider>
          <GuideProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<ActivationRouter />} />
                <Route path="/activate" element={<ActivationRouter />} />
                <Route path="/dashboard" element={<QuickBooksShell />} />
                <Route path="/standalone" element={<Dashboard />} />
                <Route path="/items" element={<Items />} />
                <Route path="/qb-success" element={<QBSuccess />} />
                <Route path="/provider-test" element={<ProviderTest />} />
                <Route path="/qa" element={<QA />} />
                <Route path="/test-admin" element={<TestAdmin />} />
              </Routes>
            </BrowserRouter>
          </GuideProvider>
        </UpgradeModalProvider>
      </SubscriptionProvider>
    </ThemeProvider>
  );
}

export default App;





