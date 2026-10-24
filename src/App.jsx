import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';

export default function App() {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/landing" />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    )
} 