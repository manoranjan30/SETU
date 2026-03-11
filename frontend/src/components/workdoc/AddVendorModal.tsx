import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import api from "../../api/axios";
import { toast } from "react-hot-toast";

interface VendorFormData {
  vendorCode: string;
  name: string;
  gstin: string;
  pan: string;
  address: string;
  state: string;
  kindAttention: string;
  mobileNumber: string;
  contactPhone: string;
  telNo: string;
  faxNo: string;
  contactEmail: string;
  uamNo: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (vendor?: any) => void;
  initialData?: Partial<VendorFormData>;
  vendorId?: number; // If provided, we're editing an existing vendor
}

const emptyForm: VendorFormData = {
  vendorCode: "",
  name: "",
  gstin: "",
  pan: "",
  address: "",
  state: "",
  kindAttention: "",
  mobileNumber: "",
  contactPhone: "",
  telNo: "",
  faxNo: "",
  contactEmail: "",
  uamNo: "",
};

const AddVendorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  vendorId,
}) => {
  const [formData, setFormData] = useState<VendorFormData>(emptyForm);
  const [loading, setLoading] = useState(false);

  const isEditMode = !!vendorId;

  useEffect(() => {
    if (initialData) {
      setFormData({ ...emptyForm, ...initialData });
    } else {
      setFormData(emptyForm);
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (isEditMode) {
        res = await api.post(`/workdoc/vendors/${vendorId}/update`, formData);
        toast.success("Vendor updated successfully");
      } else {
        res = await api.post("/workdoc/vendors", formData);
        toast.success("Vendor created successfully");
      }
      onSuccess(res.data);
      setFormData(emptyForm);
      onClose();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          `Failed to ${isEditMode ? "update" : "create"} vendor`,
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "mt-1 block w-full border border-border-strong rounded-md shadow-sm p-2.5 text-sm focus:ring-primary focus:border-primary";
  const labelClass =
    "block text-xs font-medium text-text-secondary uppercase tracking-wide";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Edit Vendor" : "Create New Vendor"}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="bg-surface-base p-4 rounded-lg border border-border-default">
          <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full"></span>
            Basic Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Vendor Code (SAP) *</label>
              <input
                type="text"
                required
                className={inputClass}
                value={formData.vendorCode}
                onChange={(e) =>
                  setFormData({ ...formData, vendorCode: e.target.value })
                }
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>Vendor Name *</label>
              <input
                type="text"
                required
                className={inputClass}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Tax & Compliance */}
        <div className="bg-surface-base p-4 rounded-lg border border-border-default">
          <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-success rounded-full"></span>
            Tax & Compliance
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>PAN</label>
              <input
                type="text"
                className={inputClass}
                value={formData.pan}
                maxLength={10}
                placeholder="AAAAA0000A"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pan: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            <div>
              <label className={labelClass}>GSTIN</label>
              <input
                type="text"
                className={inputClass}
                value={formData.gstin}
                maxLength={15}
                placeholder="29AAAAA0000A1Z5"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gstin: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            <div>
              <label className={labelClass}>UAM/Udyam No.</label>
              <input
                type="text"
                className={inputClass}
                value={formData.uamNo}
                placeholder="MSME Registration"
                onChange={(e) =>
                  setFormData({ ...formData, uamNo: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-surface-base p-4 rounded-lg border border-border-default">
          <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            Address
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>Contact Address</label>
              <textarea
                rows={2}
                className={inputClass}
                value={formData.address}
                placeholder="Full address..."
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass}>State (with Code)</label>
              <input
                type="text"
                className={inputClass}
                value={formData.state}
                placeholder="Karnataka - 29"
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-surface-base p-4 rounded-lg border border-border-default">
          <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            Contact Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Kind Attention</label>
              <input
                type="text"
                className={inputClass}
                value={formData.kindAttention}
                placeholder="Contact Person"
                onChange={(e) =>
                  setFormData({ ...formData, kindAttention: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass}>Mobile Number</label>
              <input
                type="tel"
                className={inputClass}
                value={formData.mobileNumber}
                placeholder="+91 98765 43210"
                onChange={(e) =>
                  setFormData({ ...formData, mobileNumber: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                value={formData.contactEmail}
                placeholder="vendor@example.com"
                onChange={(e) =>
                  setFormData({ ...formData, contactEmail: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass}>Telephone</label>
              <input
                type="tel"
                className={inputClass}
                value={formData.telNo}
                onChange={(e) =>
                  setFormData({ ...formData, telNo: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass}>FAX</label>
              <input
                type="text"
                className={inputClass}
                value={formData.faxNo}
                onChange={(e) =>
                  setFormData({ ...formData, faxNo: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark disabled:bg-blue-300 transition-all shadow-md shadow-blue-100"
          >
            {loading
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Vendor"
                : "Create Vendor"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddVendorModal;
