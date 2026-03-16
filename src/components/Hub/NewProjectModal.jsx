import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  createProject,
  getAllProfiles,
  bulkUpsertMilestones,
  bulkUpsertPlanTasks,
  bulkUpsertSOWItems,
  bulkUpsertPayments,
  syncDeal
} from '../../lib/supabase';
import {
  getTemplateForCategory,
  SOW_TEMPLATE,
  PAYMENTS_TEMPLATE,
  APPLICATIONS
} from '../../lib/templates';

export default function NewProjectModal({ isOpen, onClose, onProjectCreated }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dmProfiles, setDmProfiles] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category: 'MES',
    dm_id: user?.id || '',
    record_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadDmProfiles();
      if (user?.role === 'dm') {
        setFormData((prev) => ({ ...prev, dm_id: user.id }));
      }
    }
  }, [isOpen, user]);

  const loadDmProfiles = async () => {
    try {
      const profiles = await getAllProfiles();
      setDmProfiles(profiles.filter((p) => p.role === 'dm') || []);
    } catch (error) {
      console.error('Error loading DM profiles:', error);
      toast.error('Failed to load delivery managers');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    if (!formData.dm_id) {
      toast.error('Delivery Manager is required');
      return;
    }

    try {
      setLoading(true);

      // Create the project
      const newProject = await createProject({
        name: formData.name,
        category: formData.category,
        dm_id: formData.dm_id,
        record_id: formData.record_id || null,
        deal_status: 'Ready for Onboarding'
      });

      if (!newProject || !newProject.id) {
        throw new Error('Failed to create project');
      }

      const projectId = newProject.id;

      // Load template milestones and tasks
      const template = getTemplateForCategory(formData.category);
      if (template) {
        // Strip dates from milestone templates
        const milestonesToInsert = (template.milestones || []).map((m) => ({
          ...m,
          project_id: projectId,
          planned_start: null,
          planned_end: null,
          baseline_planned_start: null,
          baseline_planned_end: null
        }));

        if (milestonesToInsert.length > 0) {
          await bulkUpsertMilestones(milestonesToInsert);
        }

        // Strip dates from task templates
        const tasksToInsert = (template.tasks || []).map((t) => ({
          ...t,
          project_id: projectId,
          planned_start: null,
          planned_end: null,
          baseline_planned_start: null,
          baseline_planned_end: null
        }));

        if (tasksToInsert.length > 0) {
          await bulkUpsertPlanTasks(tasksToInsert);
        }
      }

      // Load SOW template
      const sowItemsToInsert = (SOW_TEMPLATE || []).map((item) => ({
        ...item,
        project_id: projectId
      }));

      if (sowItemsToInsert.length > 0) {
        await bulkUpsertSOWItems(sowItemsToInsert);
      }

      // Load Payments template
      const paymentsToInsert = (PAYMENTS_TEMPLATE || []).map((payment) => ({
        ...payment,
        project_id: projectId
      }));

      if (paymentsToInsert.length > 0) {
        await bulkUpsertPayments(paymentsToInsert);
      }

      // Sync deal
      await syncDeal(projectId);

      toast.success('Project created successfully');
      setFormData({ name: '', category: 'MES', dm_id: user?.id || '', record_id: '' });
      onProjectCreated();
      onClose();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error(error.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">New Project</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Project Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter project name"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Category *
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
            >
              {APPLICATIONS.map((app) => (
                <option key={app} value={app}>
                  {app}
                </option>
              ))}
            </select>
          </div>

          {/* Delivery Manager */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Delivery Manager *
            </label>
            <select
              name="dm_id"
              value={formData.dm_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
            >
              <option value="">Select a delivery manager</option>
              {dmProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          {/* Record ID */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Record ID (Optional)
            </label>
            <input
              type="text"
              name="record_id"
              value={formData.record_id}
              onChange={handleChange}
              placeholder="Enter record ID"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
