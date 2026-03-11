import { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  FlaskConical,
  Calendar,
  Package,
} from "lucide-react";
import api from "../../../api/axios";

interface Props {
  projectId: number;
}

const QualityMaterialTest: React.FC<Props> = ({ projectId }) => {
  const [tests, setTests] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    projectId,
    materialName: "",
    batchNumber: "",
    supplier: "",
    receivedDate: new Date().toISOString().split("T")[0],
    testDate: new Date().toISOString().split("T")[0],
    testType: "Cube Test",
    result: "Pass",
    testParameters: "",
    status: "Approved",
  });

  const fetchTests = async () => {
    try {
      const response = await api.get(`/quality/${projectId}/material-tests`);
      setTests(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTests();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/quality/material-tests/${editingItem.id}`, formData);
      } else {
        await api.post("/quality/material-tests", formData);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      resetForm();
      fetchTests();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this test record?")) return;
    try {
      await api.delete(`/quality/material-tests/${id}`);
      fetchTests();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      projectId,
      materialName: "",
      batchNumber: "",
      supplier: "",
      receivedDate: new Date().toISOString().split("T")[0],
      testDate: new Date().toISOString().split("T")[0],
      testType: "Cube Test",
      result: "Pass",
      testParameters: "",
      status: "Approved",
    });
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      projectId: item.projectId,
      materialName: item.materialName,
      batchNumber: item.batchNumber,
      supplier: item.supplier,
      receivedDate: item.receivedDate,
      testDate: item.testDate,
      testType: item.testType,
      result: item.result,
      testParameters: item.testParameters || "",
      status: item.status,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4 bg-surface-card px-4 py-2 rounded-xl border border-border-subtle shadow-sm w-96">
          <Search className="w-4 h-4 text-text-disabled" />
          <input
            type="text"
            placeholder="Search material tests..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full"
          />
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2.5 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
        >
          <Plus className="w-4 h-4" />
          <span className="font-bold">Log Test Result</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tests.map((test) => (
          <div
            key={test.id}
            className="bg-surface-card rounded-2xl border border-border-subtle shadow-sm p-6 hover:shadow-md transition-all relative group"
          >
            <div className="flex justify-between items-start mb-4">
              <div
                className={`p-2 rounded-lg ${test.result === "Pass" ? "bg-success-muted text-success" : "bg-error-muted text-error"}`}
              >
                <FlaskConical className="w-6 h-6" />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEditModal(test)}
                  className="p-1.5 hover:bg-surface-raised rounded-lg text-text-muted"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(test.id)}
                  className="p-1.5 hover:bg-error-muted rounded-lg text-error"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <h4 className="font-bold text-text-primary text-lg">
              {test.materialName}
            </h4>
            <p className="text-sm text-text-muted mb-4">{test.testType}</p>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-text-disabled flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Batch No.
                </span>
                <span className="font-medium text-text-secondary">
                  {test.batchNumber}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-disabled flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Test Date
                </span>
                <span className="font-medium text-text-secondary">
                  {test.testDate}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-disabled">Result</span>
                <span
                  className={`font-bold ${test.result === "Pass" ? "text-success" : "text-error"}`}
                >
                  {test.result}
                </span>
              </div>
            </div>

            <div
              className={`mt-auto pt-3 border-t border-gray-50 flex items-center justify-between`}
            >
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full ${test.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
              >
                {test.status}
              </span>
              <span className="text-[10px] text-text-disabled uppercase font-black">
                {test.supplier}
              </span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-surface-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-surface-base">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-orange-600" />
                {editingItem ? "Edit Test Record" : "Log New Material Test"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="p-6 grid grid-cols-2 gap-4"
            >
              <div className="col-span-2">
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Material Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. M25 Concrete, TMT Steel Fe500"
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.materialName}
                  onChange={(e) =>
                    setFormData({ ...formData, materialName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Batch / Tag Number
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.batchNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, batchNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.supplier}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Received Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.receivedDate}
                  onChange={(e) =>
                    setFormData({ ...formData, receivedDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Test Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.testDate}
                  onChange={(e) =>
                    setFormData({ ...formData, testDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Test Type
                </label>
                <select
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.testType}
                  onChange={(e) =>
                    setFormData({ ...formData, testType: e.target.value })
                  }
                >
                  <option value="Cube Test">
                    Cube Test (Compressive Strength)
                  </option>
                  <option value="Steel Tensile">Steel Tensile Test</option>
                  <option value="Chemical Analysis">Chemical Analysis</option>
                  <option value="Impact Test">Impact Test</option>
                  <option value="Sieve Analysis">Sieve Analysis</option>
                  <option value="Slump Test">Slump Test</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Result
                </label>
                <select
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.result}
                  onChange={(e) =>
                    setFormData({ ...formData, result: e.target.value })
                  }
                >
                  <option value="Pass">Pass</option>
                  <option value="Fail">Fail</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-text-disabled uppercase mb-1">
                  Test Parameters / Remarks
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-surface-base border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                  value={formData.testParameters}
                  onChange={(e) =>
                    setFormData({ ...formData, testParameters: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2 mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-raised transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all"
                >
                  {editingItem ? "Update Record" : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityMaterialTest;
