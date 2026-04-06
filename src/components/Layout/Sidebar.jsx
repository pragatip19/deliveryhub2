import { NavLink, useParams, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  Home, FileText, Calendar, ClipboardList, Users, CreditCard,
  MessageSquare, AlertTriangle, FileBox, Activity, ChevronDown,
  ChevronRight, BarChart2, TrendingUp, DollarSign, Briefcase, Zap
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEM = 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition';
const ACTIVE   = 'bg-blue-50 text-blue-700';
const INACTIVE = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

export default function Sidebar({ open }) {
  const { id: projectId } = useParams();
  const location = useLocation();
  const { isAdmin, isLeadership } = useAuth();
  const [raidOpen, setRaidOpen] = useState(false);
  const showDeals = isAdmin() || isLeadership();

  if (!open) return null;

  const isProject = location.pathname.startsWith('/project/');

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col py-3 overflow-y-auto flex-shrink-0">
      {/* Hub */}
      <div className="px-2 mb-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${NAV_ITEM} ${isActive && !isProject ? ACTIVE : INACTIVE}`}
        >
          <Home className="w-4 h-4" />
          Hub
        </NavLink>
      </div>

      {/* Deals — admin & leadership only */}
      {showDeals && (
        <div className="px-2 mb-1">
          <DealsNav location={location} />
        </div>
      )}

      {/* HubSpot */}
      <div className="px-2 mb-1">
        <NavLink
          to="/hubspot"
          className={({ isActive }) => `${NAV_ITEM} ${isActive ? ACTIVE : INACTIVE}`}
        >
          <Zap className="w-4 h-4" />
          HubSpot
        </NavLink>
      </div>

      {/* Project-specific navigation */}
      {isProject && projectId && (
        <>
          <div className="px-3 py-1.5 mt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project</p>
          </div>

          <div className="px-2 space-y-0.5">
            <ProjectNavLink to={`/project/${projectId}/health`} icon={Activity}>Health</ProjectNavLink>
            <ProjectNavLink to={`/project/${projectId}/sow`}    icon={FileText}>SOW</ProjectNavLink>
            <ProjectNavLink to={`/project/${projectId}/milestones`} icon={Calendar}>Milestones</ProjectNavLink>
            <ProjectNavLink to={`/project/${projectId}/plan`}   icon={ClipboardList}>Project Plan</ProjectNavLink>
            <ProjectNavLink to={`/project/${projectId}/people`} icon={Users}>People</ProjectNavLink>
            <ProjectNavLink to={`/project/${projectId}/payments`} icon={CreditCard}>Payments</ProjectNavLink>
            <ProjectNavLink to={`/project/${projectId}/uat`}    icon={FileBox}>UAT</ProjectNavLink>

            {/* RAID expandable */}
            <button
              onClick={() => setRaidOpen(o => !o)}
              className={`${NAV_ITEM} ${INACTIVE} w-full justify-between`}
            >
              <span className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4" />
                RAID
              </span>
              {raidOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {raidOpen && (
              <div className="ml-4 space-y-0.5">
                <ProjectNavLink to={`/project/${projectId}/risks`}        small>Risks</ProjectNavLink>
                <ProjectNavLink to={`/project/${projectId}/assumptions`}  small>Assumptions</ProjectNavLink>
                <ProjectNavLink to={`/project/${projectId}/issues`}       small>Issues</ProjectNavLink>
                <ProjectNavLink to={`/project/${projectId}/dependencies`} small>Dependencies</ProjectNavLink>
              </div>
            )}

            <ProjectNavLink to={`/project/${projectId}/feedback`}  icon={MessageSquare}>Feedback</ProjectNavLink>
            <ProjectNavLink to={`/project/${projectId}/documents`} icon={FileBox}>Documents</ProjectNavLink>
          </div>
        </>
      )}
    </aside>
  );
}

function ProjectNavLink({ to, icon: Icon, children, small }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${NAV_ITEM} ${isActive ? ACTIVE : INACTIVE} ${small ? 'text-xs py-1.5' : ''}`
      }
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </NavLink>
  );
}

function DealsNav({ location }) {
  const [open, setOpen] = useState(location.pathname.startsWith('/deals'));
  const isActive = location.pathname.startsWith('/deals');

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`${NAV_ITEM} ${isActive ? ACTIVE : INACTIVE} w-full justify-between`}
      >
        <span className="flex items-center gap-2.5">
          <Briefcase className="w-4 h-4" />
          Deals
        </span>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          <NavLink
            to="/deals/all"
            className={({ isActive }) => `${NAV_ITEM} text-xs py-1.5 ${isActive ? ACTIVE : INACTIVE}`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            All Deals
          </NavLink>
          <NavLink
            to="/deals/pending-revenue"
            className={({ isActive }) => `${NAV_ITEM} text-xs py-1.5 ${isActive ? ACTIVE : INACTIVE}`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Pending Revenue
          </NavLink>
          <NavLink
            to="/deals/revenue-projection"
            className={({ isActive }) => `${NAV_ITEM} text-xs py-1.5 ${isActive ? ACTIVE : INACTIVE}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Revenue Projection
          </NavLink>
        </div>
      )}
    </div>
  );
}
