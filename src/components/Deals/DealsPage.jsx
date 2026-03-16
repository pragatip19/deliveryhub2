import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import AllDeals from './AllDeals';
import PendingRevenue from './PendingRevenue';
import RevenueProjection from './RevenueProjection';
import { useAuth } from '../../contexts/AuthContext';

export default function DealsPage() {
  const { isAdmin, isLeadership } = useAuth();
  if (!isAdmin() && !isLeadership()) return <Navigate to="/" replace />;

  return (
    <div className="h-full flex flex-col">
      {/* Sub-tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-1">
        <SubTab to="/deals/all">All Deals</SubTab>
        <SubTab to="/deals/pending-revenue">Pending Revenue</SubTab>
        <SubTab to="/deals/revenue-projection">Revenue Projection</SubTab>
      </div>
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route index element={<Navigate to="all" replace />} />
          <Route path="all" element={<AllDeals />} />
          <Route path="pending-revenue" element={<PendingRevenue />} />
          <Route path="revenue-projection" element={<RevenueProjection />} />
        </Routes>
      </div>
    </div>
  );
}

function SubTab({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-3 text-sm font-medium border-b-2 transition ${
          isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
