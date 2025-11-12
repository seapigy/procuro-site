import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { Dashboard } from './components/Dashboard';
import { QuickBooksShell } from './layouts/QuickBooksShell';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="procuro-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<QuickBooksShell />} />
          <Route path="/standalone" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;





