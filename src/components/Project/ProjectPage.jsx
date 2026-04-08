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
import DeliveryPlanTab from './DeliveryPlan/DeliveryPlanTab';


export default function ProjectPage() {
  const { id: projectId } = useParams();
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
          <Route path="delivery-plan" element={<DeliveryPlanTab project={project} canEdit={canEdit} />} />
          <Route path="people" element={<PeopleTab project={project} canEdit={canEdit} />} />
          <Route
            path="payments"
            element={<PaymentsTab project={project} canEdit={canEdit} />}
          />
          <Route path="uat" element={<UATTab project={project} canEdit={canEdit} />} />
          <Route path="risks"        element={<RaidTable project={project} canEdit={canEdit} type="risk" />} />
          <Route path="assumptions"  element={<RaidTable project={project} canEdit={canEdit} type="assumption" />} />
          <Route path="issues"       element={<RaidTable project={project} canEdit={canEdit} type="issue" />} />
          <Route path="dependencies" element={<RaidTable project={project} canEdit={canEdit} type="dependency" />} />
          {/* Legacy combined RAID route */}
          <Route path="raid" element={
            <div className="space-y-6">
              {['risk','assumption','issue','dependency'].map(t => (
                <RaidTable key={t} project={project} canEdit={canEdit} type={t} />
              ))}
            </div>
          } />
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
