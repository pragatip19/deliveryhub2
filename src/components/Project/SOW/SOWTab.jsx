import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSOWItems,
  bulkUpsertSOWItems,
  upsertSOWItem,
  deleteSOWItem,
  getSOWDropdownOptions,
  upsertSOWDropdownOption,
} from '../../../lib/supabase';
import {
  SOW_TEMPLATE,
  SOW_SECTIONS,
  SOW_DROPDOWN_OPTIONS,
} from '../../../lib/templates';

const SOWTab = ({ project, canEdit }) => {
  const [sections, setSections] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState(SOW_DROPDOWN_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState(
    SOW_SECTIONS.reduce((acc, section) => ({ ...acc, [section]: true }), {})
  );
  const [saving, setSaving] = useState(false);
  const [debounceTimers, setDebounceTimers] = useState({});

  // Load SOW items and dropdown options on mount
  useEffect(() => {
    const loadSOWData = async () => {
      try {
        setLoading(true);
        const items = await getSOWItems(project.id);
        const options = await getSOWDropdownOptions(project.id);

        // Organize items by section
        const organizedSections = SOW_SECTIONS.map((sectionName) => ({
          name: sectionName,
          items: items.filter((item) => item.section === sectionName) || [],
        }));

        setSections(organizedSections);
        setDropdownOptions({ ...SOW_DROPDOWN_OPTIONS, ...options });
      } catch (error) {
        console.error('Failed to load SOW data:', error);
        toast.error('Failed to load SOW data');
      } finally {
        setLoading(false);
      }
    };

    if (project?.id) {
      loadSOWData();
    }
  }, [project?.id]);

  // Toggle section expansion
  const toggleSection = (sectionName) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  // Debounced auto-save for item changes
  const autoSaveItem = useCallback(
    (itemId, updates) => {
      // Clear existing timer for this item
      if (debounceTimers[itemId]) {
        clearTimeout(debounceTimers[itemId]);
      }

      // Set new timer
      const timer = setTimeout(async () => {
        try {
          setSaving(true);
          await upsertSOWItem(project.id, itemId, updates);
          toast.success('Changes saved');
        } catch (error) {
          console.error('Failed to save SOW item:', error);
          toast.error('Failed to save changes');
        } finally {
          setSaving(false);
        }
      }, 1000);

      setDebounceTimers((prev) => ({ ...prev, [itemId]: timer }));
    },
    [debounceTimers, project.id]
  );

  // Update item field
  const handleItemChange = (sectionName, itemIndex, field, value) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.name === sectionName) {
          const updatedItems = [...section.items];
          const item = updatedItems[itemIndex];
          updatedItems[itemIndex] = { ...item, [field]: value };
          autoSaveItem(item.id, { [field]: value });
          return { ...section, items: updatedItems };
        }
        return section;
      })
    );
  };

  // Add new row to section
  const handleAddRow = (sectionName) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.name === sectionName) {
          const newItem = {
            id: `temp-${Date.now()}`,
            section: sectionName,
            work_item: '',
            specification: '',
            notes: '',
            project_id: project.id,
          };
          return { ...section, items: [...section.items, newItem] };
        }
        return section;
      })
    );
  };

  // Delete row from section
  const handleDeleteRow = async (sectionName, itemIndex) => {
    const itemToDelete = sections.find((s) => s.name === sectionName)?.items[itemIndex];
    if (!itemToDelete?.id) return;

    try {
      setSaving(true);
      if (!itemToDelete.id.startsWith('temp-')) {
        await deleteSOWItem(itemToDelete.id);
      }
      setSections((prev) =>
        prev.map((section) => {
          if (section.name === sectionName) {
            return {
              ...section,
              items: section.items.filter((_, idx) => idx !== itemIndex),
            };
          }
          return section;
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

  // Move row up
  const handleMoveRowUp = (sectionName, itemIndex) => {
    if (itemIndex === 0) return;
    setSections((prev) =>
      prev.map((section) => {
        if (section.name === sectionName) {
          const items = [...section.items];
          [items[itemIndex - 1], items[itemIndex]] = [items[itemIndex], items[itemIndex - 1]];
          return { ...section, items };
        }
        return section;
      })
    );
  };

  // Move row down
  const handleMoveRowDown = (sectionName, itemIndex) => {
    const section = sections.find((s) => s.name === sectionName);
    if (!section || itemIndex >= section.items.length - 1) return;
    setSections((prev) =>
      prev.map((section) => {
        if (section.name === sectionName) {
          const items = [...section.items];
          [items[itemIndex], items[itemIndex + 1]] = [items[itemIndex + 1], items[itemIndex]];
          return { ...section, items };
        }
        return section;
      })
    );
  };

  // Add new section (admin only)
  const handleAddSection = () => {
    const newSectionName = prompt('Enter new section name:');
    if (newSectionName?.trim()) {
      setSections((prev) => [
        ...prev,
        {
          name: newSectionName.trim(),
          items: [],
        },
      ]);
      setExpandedSections((prev) => ({
        ...prev,
        [newSectionName.trim()]: true,
      }));
      toast.success('Section added');
    }
  };

  // Handle specification dropdown change or add new option
  const handleSpecificationChange = async (sectionName, itemIndex, value, isNewOption = false) => {
    handleItemChange(sectionName, itemIndex, 'specification', value);

    // If admin added a new option, save it to dropdown options
    if (isNewOption && canEdit) {
      try {
        await upsertSOWDropdownOption(project.id, sectionName, value);
        setDropdownOptions((prev) => ({
          ...prev,
          [sectionName]: [...(prev[sectionName] || []), value],
        }));
      } catch (error) {
        console.error('Failed to save dropdown option:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
      {/* Header with Add Section Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Statement of Work</h2>
        {canEdit && (
          <button
            onClick={handleAddSection}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </button>
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
                  <p className="text-gray-500 text-sm italic">No items yet</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-3 px-3 font-semibold text-gray-700 w-8">#</th>
                            <th className="text-left py-3 px-3 font-semibold text-gray-700 flex-1">
                              Work Item
                            </th>
                            <th className="text-left py-3 px-3 font-semibold text-gray-700 flex-1">
                              Specification
                            </th>
                            <th className="text-left py-3 px-3 font-semibold text-gray-700 flex-1">
                              Notes
                            </th>
                            <th className="text-left py-3 px-3 font-semibold text-gray-700 w-20">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.items.map((item, itemIndex) => (
                            <tr key={item.id || itemIndex} className="border-b border-gray-200 hover:bg-gray-50">
                              {/* Row Number */}
                              <td className="py-3 px-3 text-gray-600 font-medium">{itemIndex + 1}</td>

                              {/* Work Item */}
                              <td className="py-3 px-3">
                                <input
                                  type="text"
                                  value={item.work_item || ''}
                                  onChange={(e) =>
                                    handleItemChange(section.name, itemIndex, 'work_item', e.target.value)
                                  }
                                  placeholder="Enter work item"
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                  disabled={!canEdit}
                                />
                              </td>

                              {/* Specification Dropdown or Text */}
                              <td className="py-3 px-3">
                                {dropdownOptions[section.name]?.length > 0 ? (
                                  <select
                                    value={item.specification || ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '__add_new__') {
                                        const newOption = prompt('Enter new specification option:');
                                        if (newOption?.trim()) {
                                          handleSpecificationChange(
                                            section.name,
                                            itemIndex,
                                            newOption.trim(),
                                            true
                                          );
                                        }
                                      } else {
                                        handleItemChange(section.name, itemIndex, 'specification', value);
                                      }
                                    }}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                    disabled={!canEdit}
                                  >
                                    <option value="">Select specification</option>
                                    {dropdownOptions[section.name]?.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                    {canEdit && <option value="__add_new__">+ Add New</option>}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={item.specification || ''}
                                    onChange={(e) =>
                                      handleItemChange(section.name, itemIndex, 'specification', e.target.value)
                                    }
                                    placeholder="Enter specification"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                    disabled={!canEdit}
                                  />
                                )}
                              </td>

                              {/* Notes */}
                              <td className="py-3 px-3">
                                <input
                                  type="text"
                                  value={item.notes || ''}
                                  onChange={(e) =>
                                    handleItemChange(section.name, itemIndex, 'notes', e.target.value)
                                  }
                                  placeholder="Add notes"
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                  disabled={!canEdit}
                                />
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1">
                                  {canEdit && (
                                    <>
                                      <button
                                        onClick={() => handleMoveRowUp(section.name, itemIndex)}
                                        disabled={itemIndex === 0}
                                        className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        title="Move up"
                                      >
                                        <ChevronUp className="w-4 h-4 text-gray-600" />
                                      </button>
                                      <button
                                        onClick={() => handleMoveRowDown(section.name, itemIndex)}
                                        disabled={itemIndex >= section.items.length - 1}
                                        className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        title="Move down"
                                      >
                                        <ChevronDown className="w-4 h-4 text-gray-600" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteRow(section.name, itemIndex)}
                                        disabled={saving}
                                        className="p-1 hover:bg-red-100 rounded transition disabled:opacity-50"
                                        title="Delete row"
                                      >
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Add Row Button */}
                {canEdit && (
                  <button
                    onClick={() => handleAddRow(section.name)}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition text-gray-700 font-medium"
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

      {/* Loading/Saving Indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Saving...</span>
        </div>
      )}
    </div>
  );
};

export default SOWTab;
