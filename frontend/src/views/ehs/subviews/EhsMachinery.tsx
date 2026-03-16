import { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import api from "../../../api/axios";

interface Props {
  projectId: number;
}

const EhsMachinery: React.FC<Props> = ({ projectId }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);

  const [formData, setFormData] = useState({
    equipmentName: "",
    idNumber: "",
    location: "",
    certifiedDate: "",
    expiryDate: "",
    status: "Valid",
    remarks: "",
  });

  const [stats, setStats] = useState({
    valid: 0,
    expiringSoon: 0,
    expired: 0,
  });

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const response = await api.get(`/ehs/${projectId}/machinery`);
      setData(response.data);
      calculateStats(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (items: any[]) => {
    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);

    let valid = 0;
    let expiringSoon = 0;
    let expired = 0;

    items.forEach((item) => {
      if (!item.expiryDate) {
        valid++;
        return;
      }
      const expiry = new Date(item.expiryDate);

      if (expiry < today) {
        expired++;
      } else if (expiry <= next30Days) {
        expiringSoon++;
      } else {
        valid++;
      }
    });

    setStats({ valid, expiringSoon, expired });
  };

  const getStatusStyle = (expiryDate: string) => {
    if (!expiryDate) return "";
    const today = new Date();
    const expiry = new Date(expiryDate);
    if (expiry < today) return "bg-error-muted text-red-700 font-bold";
    return "";
  };

  const getStatusLabel = (expiryDate: string) => {
    if (!expiryDate)
      return { label: "Valid", color: "bg-green-100 text-green-700" };

    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);
    const expiry = new Date(expiryDate);

    if (expiry < today)
      return { label: "Expired", color: "bg-red-100 text-red-700" };
    if (expiry <= next30Days)
      return { label: "Expiring Soon", color: "bg-orange-100 text-orange-700" };
    return { label: "Valid", color: "bg-green-100 text-green-700" };
  };

  const handleEdit = (item: any) => {
    setFormData({
      equipmentName: item.equipmentName,
      idNumber: item.idNumber,
      location: item.location,
      certifiedDate: item.certifiedDate || "",
      expiryDate: item.expiryDate || "",
      status: item.status,
      remarks: item.remarks || "",
    });
    setEditingId(item.id);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/ehs/machinery/${deleteId}`);
      setDeleteId(null);
      setDeleteStep(0);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, projectId };

      if (editingId) {
        await api.put(`/ehs/machinery/${editingId}`, payload);
      } else {
        await api.post(`/ehs/${projectId}/machinery`, payload);
      }
      setShowModal(false);
      setEditingId(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      equipmentName: "",
      idNumber: "",
      location: "",
      certifiedDate: "",
      expiryDate: "",
      status: "Valid",
      remarks: "",
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted mb-1">Valid</p>
            <p className="text-3xl font-black text-text-primary">
              {stats.valid}
            </p>
          </div>
          <div className="bg-green-100 p-3 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
        </div>
        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted mb-1">Expiring Soon</p>
            <p className="text-3xl font-black text-text-primary">
              {stats.expiringSoon}
            </p>
          </div>
          <div className="bg-orange-100 p-3 rounded-xl">
            <Clock className="w-6 h-6 text-orange-600" />
          </div>
        </div>
        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted mb-1">Expired</p>
            <p className="text-3xl font-black text-error">{stats.expired}</p>
          </div>
          <div className="bg-red-100 p-3 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-error" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="font-bold text-text-primary">Machinery & Equipment</h3>
          <button
            onClick={() => {
              setEditingId(null);
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Machinery
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-base text-xs font-bold uppercase text-text-muted">
              <tr>
                <th className="px-6 py-4">SI</th>
                <th className="px-6 py-4">Equipment</th>
                <th className="px-6 py-4">ID Number</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Certified Date</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((item, index) => {
                const status = getStatusLabel(item.expiryDate);
                const rowClass = getStatusStyle(item.expiryDate);
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-surface-base/50 ${rowClass}`}
                  >
                    <td className="px-6 py-4 font-medium">{index + 1}</td>
                    <td className="px-6 py-4 font-medium">
                      {item.equipmentName}
                    </td>
                    <td className="px-6 py-4">{item.idNumber}</td>
                    <td className="px-6 py-4">{item.location}</td>
                    <td className="px-6 py-4">
                      {item.certifiedDate
                        ? new Date(item.certifiedDate).toLocaleDateString(
                            "en-GB",
                          )
                        : "-"}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {item.expiryDate
                        ? new Date(item.expiryDate).toLocaleDateString("en-GB")
                        : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 hover:bg-primary-muted text-primary rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteId(item.id);
                            setDeleteStep(1);
                          }}
                          className="p-1.5 hover:bg-error-muted text-error rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-card w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-surface-base">
              <h3 className="font-bold text-lg">
                {editingId ? "Update" : "Add"} Machinery
              </h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-1">
                  Equipment Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                  value={formData.equipmentName}
                  onChange={(e) =>
                    setFormData({ ...formData, equipmentName: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-1">
                    ID Number
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                    value={formData.idNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, idNumber: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-1">
                    Certified Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                    value={formData.certifiedDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        certifiedDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none"
                    value={formData.expiryDate}
                    onChange={(e) =>
                      setFormData({ ...formData, expiryDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-1">
                  Remarks
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600/20 outline-none h-20"
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white py-2 rounded-lg font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {editingId ? "Update Machinery" : "Add Machinery"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteStep > 0 && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-error" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">
              {deleteStep === 1
                ? "Delete Equipment?"
                : "Are you absolutely sure?"}
            </h3>
            <p className="text-sm text-text-muted mb-6">
              {deleteStep === 1
                ? "This action will remove this equipment record permanently."
                : "This action cannot be undone. Confirm deletion?"}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setDeleteStep(0);
                  setDeleteId(null);
                }}
                className="px-4 py-2 bg-surface-raised text-text-secondary rounded-lg font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deleteStep === 1 ? setDeleteStep(2) : handleDelete()
                }
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
              >
                {deleteStep === 1 ? "Yes, Delete" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EhsMachinery;
