import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { Dashboard } from './components/Dashboard';
import { QuickBooksShell } from './layouts/QuickBooksShell';
import { ProviderTest } from './pages/ProviderTest';
import { QA } from './pages/QA';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="procuro-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<QuickBooksShell />} />
          <Route path="/standalone" element={<Dashboard />} />
          <Route path="/provider-test" element={<ProviderTest />} />
          <Route path="/qa" element={<QA />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;





