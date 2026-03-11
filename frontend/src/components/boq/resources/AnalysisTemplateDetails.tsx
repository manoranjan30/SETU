import React, { useState, useEffect } from "react";
import { Save, Plus, Trash } from "lucide-react";
import api from "../../../api/axios";

interface Props {
  templateId: number;
  onUpdate: () => void;
}

const AnalysisTemplateDetails: React.FC<Props> = ({ templateId, onUpdate }) => {
  const [template, setTemplate] = useState<any>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [templateId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tmplRes, resRes] = await Promise.all([
        api.get(`/resources/templates/${templateId}`),
        api.get("/resources/master"),
      ]);
      setTemplate(tmplRes.data);
      setResources(resRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCoefficient = () => {
    if (!resources.length) return alert("Create resources first!");
    const newCoeff = {
      resourceId: resources[0].id,
      coefficient: 1,
      remarks: "",
    };
    const updatedCoeffs = [...(template.coefficients || []), newCoeff];
    setTemplate({ ...template, coefficients: updatedCoeffs });
  };

  const handleUpdateCoefficient = (
    index: number,
    field: string,
    value: any,
  ) => {
    const updatedCoeffs = [...template.coefficients];
    updatedCoeffs[index] = { ...updatedCoeffs[index], [field]: value };
    setTemplate({ ...template, coefficients: updatedCoeffs });
  };

  const handleRemoveCoefficient = (index: number) => {
    const updatedCoeffs = template.coefficients.filter(
      (_: any, i: number) => i !== index,
    );
    setTemplate({ ...template, coefficients: updatedCoeffs });
  };

  const handleSave = async () => {
    try {
      await api.put(`/resources/templates/${templateId}`, template);
      alert("Saved!");
      onUpdate();
    } catch (err) {
      alert("Failed to save");
    }
  };

  if (loading || !template) return <div className="p-4">Loading...</div>;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border-default bg-surface-card">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              {template.templateCode}
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-normal">
                {template.status}
              </span>
            </h2>
            <input
              className="mt-1 block w-full text-sm text-text-secondary border-none p-0 focus:ring-0"
              value={template.description}
              onChange={(e) =>
                setTemplate({ ...template, description: e.target.value })
              }
            />
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-1 bg-secondary text-white px-4 py-2 rounded-md hover:bg-secondary-dark"
          >
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-surface-card border border-border-default rounded-lg shadow-sm">
          <div className="px-4 py-3 border-b border-border-default bg-surface-base flex justify-between items-center">
            <h3 className="text-sm font-semibold text-text-secondary">
              Rate Analysis Ingredients
            </h3>
            <button
              onClick={handleAddCoefficient}
              className="text-xs flex items-center gap-1 text-secondary hover:text-indigo-800"
            >
              <Plus className="w-3 h-3" /> Add Resource
            </button>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-base text-text-muted font-medium">
              <tr>
                <th className="px-4 py-2">Resource</th>
                <th className="px-4 py-2 w-32">Coefficient</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Remarks</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {template.coefficients?.map((coeff: any, idx: number) => {
                // Find resource details for display (if ID only)
                const res =
                  resources.find((r) => r.id === coeff.resourceId) || {};

                return (
                  <tr key={idx} className="group hover:bg-surface-base">
                    <td className="px-4 py-2">
                      <select
                        className="w-full border-border-strong rounded-md text-sm focus:ring-secondary focus:border-secondary"
                        value={coeff.resourceId}
                        onChange={(e) =>
                          handleUpdateCoefficient(
                            idx,
                            "resourceId",
                            parseInt(e.target.value),
                          )
                        }
                      >
                        {/* Group by ResourceType */}
                        {Array.from(
                          new Set(resources.map((r) => r.resourceType)),
                        ).map((type) => (
                          <optgroup key={type} label={type}>
                            {resources
                              .filter((r) => r.resourceType === type)
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.resourceName} ({r.resourceCode})
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full border-border-strong rounded-md text-sm focus:ring-secondary focus:border-secondary"
                        value={coeff.coefficient}
                        onChange={(e) =>
                          handleUpdateCoefficient(
                            idx,
                            "coefficient",
                            parseFloat(e.target.value),
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-text-muted">{res.uom}</td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        className="w-full border-border-strong rounded-md text-sm focus:ring-secondary focus:border-secondary"
                        value={coeff.remarks || ""}
                        onChange={(e) =>
                          handleUpdateCoefficient(
                            idx,
                            "remarks",
                            e.target.value,
                          )
                        }
                        placeholder="Notes..."
                      />
                    </td>
                    <td className="px-4 py-2 text-center text-text-secondary font-medium">
                      ₹
                      {(
                        (res.standardRate || 0) * (coeff.coefficient || 0)
                      ).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleRemoveCoefficient(idx)}
                        className="text-text-disabled hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!template.coefficients?.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-text-disabled italic"
                  >
                    No resources added. Click "Add Resource" to define the
                    recipe.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Summary Footer */}
            {template.coefficients?.length > 0 && (
              <tfoot className="bg-surface-base border-t-2 border-border-default">
                {(() => {
                  const breakdown = template.coefficients.reduce(
                    (acc: any, coeff: any) => {
                      const res =
                        resources.find((r) => r.id === coeff.resourceId) || {};
                      const type = res.resourceType || "OTHER";
                      const cost =
                        (res.standardRate || 0) * (coeff.coefficient || 0);
                      acc[type] = (acc[type] || 0) + cost;
                      acc.total = (acc.total || 0) + cost;
                      return acc;
                    },
                    { total: 0 },
                  );

                  return (
                    <>
                      {Object.entries(breakdown)
                        .filter(([k]) => k !== "total")
                        .map(([type, amount]: any) => (
                          <tr key={type} className="text-text-secondary">
                            <td
                              colSpan={4}
                              className="px-4 py-1.5 text-right font-medium"
                            >
                              {type} Subtotal:
                            </td>
                            <td className="px-4 py-1.5 text-center font-semibold">
                              ₹{amount.toFixed(2)}
                            </td>
                            <td></td>
                          </tr>
                        ))}
                      <tr className="bg-secondary-muted text-indigo-900 border-t border-indigo-100">
                        <td
                          colSpan={4}
                          className="px-4 py-3 text-right font-bold text-lg"
                        >
                          Total Unit Rate ({template.outputUom}):
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-xl">
                          ₹{breakdown.total.toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </>
                  );
                })()}
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalysisTemplateDetails;
