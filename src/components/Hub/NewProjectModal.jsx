import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  createProject,
  getAllProfiles,
  getCategories,
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
} from '../../lib/templates';

export default function NewProjectModal({ isOpen, onClose, onProjectCreated }) {
  const { user, profile, isAdmin, isDM } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dmProfiles, setDmProfiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    dm_id: '',
    record_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [profiles, cats] = await Promise.all([getAllProfiles(), getCategories()]);
      setDmProfiles(profiles || []);
      setCategories(cats || []);

      // Default category to first available
      const defaultCat = cats?.[0];
      // Default DM: if current user is DM, set to themselves
      const defaultDmId = isDM() ? profile?.id : '';

      setFormData({
        name: '',
        category_id: defaultCat?.id || '',
        dm_id: defaultDmId,
        record_id: ''
      });
    } catch (error) {
      console.error('Error loading modal data:', error);
      toast.error('Failed to load form data');
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
    if (!formData.category_id) {
      toast.error('Application is required');
      return;
    }
    if (!formData.dm_id) {
      toast.error('Delivery Manager is required');
      return;
    }

    try {
      setLoading(true);

      // Get category name for template lookup
      const selectedCat = categories.find(c => c.id === formData.category_id);
      const categoryName = selectedCat?.name || '';

      // Create the project
      const newProject = await createProject({
        name: formData.name.trim(),
        category_id: formData.category_id,
        dm_id: formData.dm_id,
        record_id: formData.record_id || null,
        deal_status: 'Ready for Onboarding',
        uat_type: ['CLEEN'].includes(categoryName) ? null : (categoryName === 'Logbooks' ? 'logbooks' : 'mes'),
      });

      if (!newProject?.id) throw new Error('Failed to create project');
      const projectId = newProject.id;

      // Load template milestones and tasks
      const template = getTemplateForCategory(categoryName);
      if (template) {
        const milestonesToInsert = (template.milestones || []).map((m) => ({
          name: typeof m === 'string' ? m : m.name,
          status: (typeof m === 'object' && m.status) ? m.status : 'Not Started',
          project_id: projectId,
          planned_start: null,
          planned_end: null,
          baseline_planned_start: null,
          baseline_planned_end: null
        }));
        if (milestonesToInsert.length > 0) await bulkUpsertMilestones(milestonesToInsert);

        const tasksToInsert = (template.tasks || []).map((t) => ({
          ...t,
          project_id: projectId,
          planned_start: null,
          planned_end: null,
          baseline_planned_start: null,
          baseline_planned_end: null,
          actual_start: null,
          current_end: null,
        }));
        if (tasksToInsert.length > 0) await bulkUpsertPlanTasks(tasksToInsert);
      }

      // Load SOW template
      const sowItems = (SOW_TEMPLATE || []).map((item) => ({ ...item, project_id: projectId }));
      if (sowItems.length > 0) await bulkUpsertSOWItems(sowItems);

      // Load Payments template
      const paymentItems = (PAYMENTS_TEMPLATE || []).map((p) => ({ ...p, project_id: projectId }));
      if (paymentItems.length > 0) await bulkUpsertPayments(paymentItems);

      // Sync deal record
      try { await syncDeal(projectId); } catch (e) { console.warn('syncDeal failed:', e); }

      toast.success('Project created successfully!');
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Project Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter project name"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
            />
          </div>

          {/* Application */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Application *</label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-slate-900"
            >
              <option value="">Select application</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Delivery Manager */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Manager *</label>
            <select
              name="dm_id"
              value={formData.dm_id}
              onChange={handleChange}
              disabled={isDM()}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">Select delivery manager</option>
              {dmProfiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
            {isDM() && <p className="text-xs text-slate-400 mt-1">Assigned to you automatically</p>}
          </div>

          {/* Record ID */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Record ID (Optional)</label>
            <input
              type="text"
              name="record_id"
              value={formData.record_id}
              onChange={handleChange}
              placeholder="Enter CRM record ID"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
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
