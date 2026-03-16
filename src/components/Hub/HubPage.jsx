import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getProjects, getMyProjects } from '../../lib/supabase';
import NewProjectModal from './NewProjectModal';
import StatusBadge from '../shared/StatusBadge';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'All',
  'MES',
  'Logbooks',
  'CLEEN',
  'DMS',
  'AI Investigator',
  'LMS',
  'AI Agents'
];

const DEAL_STATUS_COLORS = {
  'Ready for Onboarding': 'bg-blue-100 text-blue-800',
  'Under Onboarding': 'bg-yellow-100 text-yellow-800',
  'Live-Under Scaleup': 'bg-green-100 text-green-800'
};

export default function HubPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [viewMode, setViewMode] = useState('my'); // 'my' or 'all'

  const isAdminOrDm = user?.role === 'admin' || user?.role === 'dm';
  const showViewToggle = user?.role === 'dm';
  const shouldShowAllProjects = user?.role === 'admin' || user?.role === 'leadership' || viewMode === 'all';

  useEffect(() => {
    loadProjects();
  }, [viewMode, shouldShowAllProjects]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      let data;
      if (shouldShowAllProjects) {
        data = await getProjects();
      } else {
        data = await getMyProjects(user?.id);
      }
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSearchedProjects = useMemo(() => {
    return projects
      .filter((project) => {
        if (selectedCategory !== 'All' && project.category !== selectedCategory) {
          return false;
        }
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            project.name.toLowerCase().includes(query) ||
            (project.dm?.name || '').toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }, [projects, selectedCategory, searchQuery]);

  const canEditProject = (project) => {
    return user?.role === 'admin' || project.dm_id === user?.id;
  };

  const handleProjectCreated = () => {
    setShowNewProjectModal(false);
    loadProjects();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-slate-900">DeliveryHub</h1>
          <div className="flex items-center gap-4">
            {showViewToggle && (
              <div className="flex gap-2 bg-white rounded-lg p-1 border border-slate-200">
                <button
                  onClick={() => setViewMode('my')}
                  className={`px-4 py-2 rounded transition-colors ${
                    viewMode === 'my'
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Projects
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-4 py-2 rounded transition-colors ${
                    viewMode === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Projects
                </button>
              </div>
            )}
            {isAdminOrDm && (
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus size={20} />
                New Project
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-xl">
          <Search
            size={20}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-8 bg-white rounded-lg p-4 border border-slate-200">
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredAndSearchedProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-600 text-lg">No projects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSearchedProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {project.name}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className="inline-block bg-slate-100 text-slate-700 text-xs font-medium px-3 py-1 rounded-full">
                      {project.category}
                    </span>
                    {project.deal_status && (
                      <span
                        className={`inline-block text-xs font-medium px-3 py-1 rounded-full ${
                          DEAL_STATUS_COLORS[project.deal_status] ||
                          DEAL_STATUS_COLORS['Ready for Onboarding']
                        }`}
                      >
                        {project.deal_status}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">DM:</span> {project.dm?.name || 'Unassigned'}
                </p>
              </div>

              <button
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                View Project
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}
