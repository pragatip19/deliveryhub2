import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, RefreshCw, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSOWItems,
  bulkUpsertSOWItems,
  upsertSOWItem,
  deleteSOWItem,
  deleteAllSOWItems,
  getSOWDropdownOptions,
  upsertSOWDropdownOption,
} from '../../../lib/supabase';
import {
  SOW_TEMPLATE,
  SOW_SECTIONS,
  SOW_DROPDOWN_OPTIONS,
  getTemplateForCategory,
} from '../../../lib/templates';

// Color map for common SOW specification values
const SOW_SPEC_COLORS = {
  'Signed':                        'bg-emerald-100 text-emerald-700',
  'Not Signed':                    'bg-red-100 text-red-700',
  'Not Required':                  'bg-gray-100 text-gray-600',
  'Pending':                       'bg-amber-100 text-amber-700',
  'Required':                      'bg-blue-100 text-blue-700',
  'Included':                      'bg-emerald-100 text-emerald-700',
  'Not Included':                  'bg-gray-100 text-gray-600',
  'Go Live scope':                 'bg-blue-100 text-blue-700',
  'Post Go Live scope':            'bg-violet-100 text-violet-700',
  'Not in scope':                  'bg-gray-100 text-gray-500',
  'Leucine Managed':               'bg-indigo-100 text-indigo-700',
  'Customer Managed':              'bg-orange-100 text-orange-700',
  'Not applicable, already live':  'bg-teal-100 text-teal-700',
};

const SOWTab = ({ project, canEdit }) => {
  const [sections, setSections] = useState([]);
  // dropdownOptions is keyed by work_item name (e.g. 'MSA' -> ['Signed', ...])
  const [dropdownOptions, setDropdownOptions] = useState(SOW_DROPDOWN_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState(
    SOW_SECTIONS.reduce((acc, section) => ({ ...acc, [section]: true }), {})
  );
  const [saving, setSaving] = useState(false);
  const debounceTimers = useRef({});

  // -------------------------------------------------------
  // Load SOW items and dropdown options on mount
  // -------------------------------------------------------
  const loadSOWData = useCallback(async () => {
    try {
      setLoading(true);
      const [items, customOptRows] = await Promise.all([
        getSOWItems(project.id),
        getSOWDropdownOptions(project.id),
      ]);

      // Organize items by section
      const organizedSections = SOW_SECTIONS.map((sectionName) => ({
        name: sectionName,
        items: items.filter((item) => item.section === sectionName),
      }));
      setSections(organizedSections);

      // Merge custom project options into SOW_DROPDOWN_OPTIONS
      // DB schema: { project_id, section (= work_item key), work_item (= option value) }
      const customOpts = {};
      (customOptRows || []).forEach((row) => {
        const key = row.section; // the work_item name used as key
        if (!customOpts[key]) customOpts[key] = [];
        customOpts[key].push(row.work_item);
      });
      setDropdownOptions((prev) => {
        const merged = { ...prev };
        Object.entries(customOpts).forEach(([key, vals]) => {
          merged[key] = [...(prev[key] || []), ...vals.filter((v) => !(prev[key] || []).includes(v))];
        });
        return merged;
      });
    } catch (error) {
      console.error('Failed to load SOW data:', error);
      toast.error('Failed to load SOW data');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    if (project?.id) loadSOWData();
  }, [project?.id, loadSOWData]);

  // -------------------------------------------------------
  // Toggle section expansion
  // -------------------------------------------------------
  const toggleSection = (sectionName) => {
    setExpandedSections((prev) => ({ ...prev, [sectionName]: !prev[sectionName] }));
  };

  // -------------------------------------------------------
  // Auto-save single field change (debounced, real UUIDs only)
  // -------------------------------------------------------
  const autoSaveItem = useCallback(
    (itemId, updates) => {
      if (!itemId || String(itemId).startsWith('temp-')) return;
      if (debounceTimers.current[itemId]) clearTimeout(debounceTimers.current[itemId]);
      debounceTimers.current[itemId] = setTimeout(async () => {
        try {
          setSaving(true);
          await upsertSOWItem(project.id, itemId, updates);
        } catch (error) {
          console.error('Failed to save SOW item:', error);
          toast.error('Failed to save changes');
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [project.id]
  );

  // -------------------------------------------------------
  // Update item field in state + trigger auto-save
  // -------------------------------------------------------
  const handleItemChange = (sectionName, itemId, field, value) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.name !== sectionName) return section;
        return {
          ...section,
          items: section.items.map((item) =>
            item.id === itemId ? { ...item, [field]: value } : item
          ),
        };
      })
    );
    autoSaveItem(itemId, { [field]: value });
  };

  // -------------------------------------------------------
  // Add new row — INSERT to DB immediately to get real UUID
  // -------------------------------------------------------
  const handleAddRow = async (sectionName) => {
    const sectionItems = sections.find((s) => s.name === sectionName)?.items || [];
    const newItem = {
      section: sectionName,
      work_item: '',
      specification: '',
      notes: '',
      project_id: project.id,
      sort_order: sectionItems.length,
    };
    try {
      const saved = await upsertSOWItem(newItem);
      setSections((prev) =>
        prev.map((section) => {
          if (section.name !== sectionName) return section;
          return { ...section, items: [...section.items, saved] };
        })
      );
    } catch (error) {
      console.error('Failed to add row:', error);
      toast.error('Failed to add row');
    }
  };

  // -------------------------------------------------------
  // Delete row
  // -------------------------------------------------------
  const handleDeleteRow = async (sectionName, itemId) => {
    try {
      setSaving(true);
      if (itemId && !String(itemId).startsWith('temp-')) {
        await deleteSOWItem(itemId);
      }
      setSections((prev) =>
        prev.map((section) => {
          if (section.name !== sectionName) return section;
          return { ...section, items: section.items.filter((item) => item.id !== itemId) };
        })
      );
      toast.success('Row deleted');
    } catch (error) {
      console.error('Failed to delete SOW item:', error);
      toast.error('Failed to delete row');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------
  // Move row up/down (local only — no DB order save needed for now)
  // -------------------------------------------------------
  const handleMoveRow = (sectionName, itemId, direction) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.name !== sectionName) return section;
        const items = [...section.items];
        const idx = items.findIndex((i) => i.id === itemId);
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= items.length) return section;
        [items[idx], items[targetIdx]] = [items[targetIdx], items[idx]];
        return { ...section, items };
      })
    );
  };

  // -------------------------------------------------------
  // Add new dropdown option for a work_item
  // -------------------------------------------------------
  const handleAddDropdownOption = async (workItemKey, sectionName, itemId, newOptionValue) => {
    if (!newOptionValue?.trim()) return;
    const val = newOptionValue.trim();
    try {
      // Save custom option to DB keyed by work_item name
      await upsertSOWDropdownOption(project.id, workItemKey, val);
      setDropdownOptions((prev) => ({
        ...prev,
        [workItemKey]: [...(prev[workItemKey] || []), val],
      }));
      // Also set this as the selected value for the current item
      handleItemChange(sectionName, itemId, 'specification', val);
    } catch (error) {
      console.error('Failed to save dropdown option:', error);
      toast.error('Failed to save option');
    }
  };

  // -------------------------------------------------------
  // Load template — bulk insert SOW_TEMPLATE rows
  // -------------------------------------------------------
  const handleLoadTemplate = async () => {
    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
    if (totalItems > 0) {
      const confirmed = window.confirm(
        'This will DELETE all existing SOW rows and replace them with the default template. Continue?'
      );
      if (!confirmed) return;
    }
    try {
      setSaving(true);
      // Delete all existing rows first to prevent duplicates
      await deleteAllSOWItems(project.id);
      const categoryTemplate = getTemplateForCategory(project?.category_name);
      const activeSOWTemplate = categoryTemplate?.sowTemplate || SOW_TEMPLATE;
      const rows = activeSOWTemplate.map((row, idx) => ({
        ...row,
        project_id: project.id,
        sort_order: idx,
      }));
      const saved = await bulkUpsertSOWItems(rows);
      // Re-organise into sections
      const organizedSections = SOW_SECTIONS.map((sectionName) => ({
        name: sectionName,
        items: saved.filter((item) => item.section === sectionName),
      }));
      setSections(organizedSections);
      toast.success('Template loaded');
    } catch (error) {
      console.error('Failed to load template:', error);
      toast.error('Failed to load template');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------
  // Add new section
  // -------------------------------------------------------
  const handleAddSection = () => {
    const newSectionName = prompt('Enter new section name:');
    if (newSectionName?.trim()) {
      setSections((prev) => [...prev, { name: newSectionName.trim(), items: [] }]);
      setExpandedSections((prev) => ({ ...prev, [newSectionName.trim()]: true }));
      toast.success('Section added');
    }
  };

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Statement of Work</h2>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadTemplate}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              Load Template
            </button>
            <button
              onClick={handleAddSection}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              Add Section
            </button>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.name} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.name)}
              className="w-full px-6 py-4 flex items-center justify-between bg-gray-100 hover:bg-gray-200 transition"
            >
              <h3 className="text-lg font-semibold text-gray-900">{section.name}</h3>
              {expandedSections[section.name] ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {/* Section Content */}
            {expandedSections[section.name] && (
              <div className="p-6">
                {section.items.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">No items yet. Add a row or load the template.</p>
                ) : (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-3 px-3 font-semibold text-gray-700 w-8">#</th>
                          <th className="text-left py-3 px-3 font-semibold text-gray-700 w-48">Work Item</th>
                          <th className="text-left py-3 px-3 font-semibold text-gray-700 flex-1">Specification</th>
                          <th className="text-left py-3 px-3 font-semibold text-gray-700 flex-1">Notes</th>
                          {canEdit && (
                            <th className="text-left py-3 px-3 font-semibold text-gray-700 w-20">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((item, itemIndex) => {
                          // Look up dropdown options by work_item name
                          const opts = dropdownOptions[item.work_item];
                          const hasDropdown = opts && opts.length > 0;

                          return (
                            <tr
                              key={item.id || itemIndex}
                              className="border-b border-gray-200 hover:bg-gray-50"
                            >
                              {/* Row Number */}
                              <td className="py-2 px-3 text-gray-500 text-xs">{itemIndex + 1}</td>

                              {/* Work Item */}
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  defaultValue={item.work_item || ''}
                                  onBlur={(e) => {
                                    if (e.target.value !== (item.work_item || ''))
                                      handleItemChange(section.name, item.id, 'work_item', e.target.value);
                                  }}
                                  placeholder="Work item"
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                  disabled={!canEdit}
                                />
                              </td>

                              {/* Specification — dropdown if options exist, else text */}
                              <td className="py-2 px-3">
                                {hasDropdown ? (
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={item.specification || ''}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '__add_new__') {
                                          const newOpt = window.prompt(
                                            `Add a new option for "${item.work_item}":`
                                          );
                                          if (newOpt?.trim()) {
                                            handleAddDropdownOption(
                                              item.work_item,
                                              section.name,
                                              item.id,
                                              newOpt.trim()
                                            );
                                          }
                                        } else {
                                          handleItemChange(section.name, item.id, 'specification', value);
                                        }
                                      }}
                                      className={`flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 font-medium ${SOW_SPEC_COLORS[item.specification] || 'bg-white text-gray-700'}`}
                                      disabled={!canEdit}
                                    >
                                      <option value="">Select...</option>
                                      {opts.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                      {canEdit && (
                                        <option value="__add_new__">＋ Add new option</option>
                                      )}
                                    </select>
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    defaultValue={item.specification || ''}
                                    onBlur={(e) => {
                                      if (e.target.value !== (item.specification || ''))
                                        handleItemChange(section.name, item.id, 'specification', e.target.value);
                                    }}
                                    placeholder="Specification"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                    disabled={!canEdit}
                                  />
                                )}
                              </td>

                              {/* Notes */}
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  defaultValue={item.notes || ''}
                                  onBlur={(e) => {
                                    if (e.target.value !== (item.notes || ''))
                                      handleItemChange(section.name, item.id, 'notes', e.target.value);
                                  }}
                                  placeholder="Notes"
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                  disabled={!canEdit}
                                />
                              </td>

                              {/* Actions */}
                              {canEdit && (
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleMoveRow(section.name, item.id, 'up')}
                                      disabled={itemIndex === 0}
                                      className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 transition"
                                      title="Move up"
                                    >
                                      <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveRow(section.name, item.id, 'down')}
                                      disabled={itemIndex >= section.items.length - 1}
                                      className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 transition"
                                      title="Move down"
                                    >
                                      <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRow(section.name, item.id)}
                                      disabled={saving}
                                      className="p-1 hover:bg-red-100 rounded transition disabled:opacity-50"
                                      title="Delete row"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Row Button */}
                {canEdit && (
                  <button
                    onClick={() => handleAddRow(section.name)}
                    disabled={saving}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition text-gray-700 font-medium disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add Row
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Saving…</span>
        </div>
      )}
    </div>
  );
};

export default SOWTab;
