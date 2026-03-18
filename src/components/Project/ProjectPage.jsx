import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Routes, Route } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { getProjectById } from '../../lib/supabase';
import ProjectHealth from './Health/ProjectHealth';
import SOWTab from './SOW/SOWTab';
import MilestonesTab from './Milestones/MilestonesTab';
import ProjectPlan from './Plan/ProjectPlan';
import PeopleTab from './People/PeopleTab';
import PaymentsTab from './Payments/PaymentsTab';
import UATTab from './UAT/UATTab';
import RaidTable from './RAID/RaidTable';
import FeedbackTab from './Feedback/FeedbackTab';
import DocumentsTab from './Documents/DocumentsTab';

const TABS = [
  { id: 'health', label: 'Health', path: 'health' },
  { id: 'sow', label: 'SOW', path: 'sow' },
  { id: 'milestones', label: 'Milestones', path: 'milestones' },
  { id: 'plan', label: 'Plan', path: 'plan' },
  { id: 'people', label: 'People', path: 'people' },
  { id: 'payments', label: 'Payments', path: 'payments' },
  { id: 'uat', label: 'UAT', path: 'uat' },
  { id: 'raid', label: 'RAID', path: 'raid' },
  { id: 'feedback', label: 'Feedback', path: 'feedback' },
  { id: 'documents', label: 'Documents', path: 'documents' }
];

export default function ProjectPage() {
  const { id: projectId, tab } = useParams();
  const navigate = useNavigate();
  const { user, canEditProject } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  useEffect(() => {
    if (project) {
      const hasEditAccess = canEditProject(project);
      setCanEdit(hasEditAccess);
    }
  }, [project, user]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const projectData = await getProjectById(projectId);
      if (!projectData) {
        toast.error('Project not found');
        navigate('/');
        return;
      }
      setProject(projectData);

      // Default to health tab if no tab is specified
      if (!tab) {
        navigate(`/project/${projectId}/health`);
      }
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const currentTab = TABS.find((t) => t.path === tab) || TABS[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Hub
          </button>
          <ChevronRight size={16} className="text-slate-400" />
          <span className="text-slate-700 font-medium">{project.name}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="px-6 overflow-x-auto">
          <div className="flex gap-1">
            {TABS.map((tabItem) => (
              <button
                key={tabItem.id}
                onClick={() => navigate(`/project/${projectId}/${tabItem.path}`)}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                  currentTab.id === tabItem.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Routes>
          <Route
            path="health"
            element={<ProjectHealth project={project} canEdit={canEdit} />}
          />
          <Route path="sow" element={<SOWTab project={project} canEdit={canEdit} />} />
          <Route
            path="milestones"
            element={<MilestonesTab project={project} canEdit={canEdit} />}
          />
          <Route path="plan" element={<ProjectPlan project={project} canEdit={canEdit} />} />
          <Route path="people" element={<PeopleTab project={project} canEdit={canEdit} />} />
          <Route
            path="payments"
            element={<PaymentsTab project={project} canEdit={canEdit} />}
          />
          <Route path="uat" element={<UATTab project={project} canEdit={canEdit} />} />
          <Route
            path="raid"
            element={<RaidTable project={project} canEdit={canEdit} type="raid" />}
          />
          <Route
            path="feedback"
            element={<FeedbackTab project={project} canEdit={canEdit} />}
          />
          <Route
            path="documents"
            element={<DocumentsTab project={project} canEdit={canEdit} />}
          />
          {/* Catch-all redirects to health */}
          <Route path="*" element={<ProjectHealth project={project} canEdit={canEdit} />} />
        </Routes>
      </div>
    </div>
  );
}
