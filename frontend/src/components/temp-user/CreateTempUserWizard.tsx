import { useState, useEffect } from "react";
import {
  tempUserService,
  type TempRoleTemplate,
} from "../../services/tempUser.service";
import { TEMP_USER_ASSIGNABLE_PERMISSIONS } from "../../pages/admin/temp-user-permissions.constants";

interface Props {
  projectId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTempUserWizard = ({
  projectId,
  onClose,
  onSuccess,
}: Props) => {
  const [step, setStep] = useState(1);
  const [vendors, setVendors] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [templates, setTemplates] = useState<TempRoleTemplate[]>([]);

  const [form, setForm] = useState({
    vendorId: "",
    workOrderId: "",
    fullName: "",
    mobile: "",
    email: "",
    designation: "",
    templateId: "",
    password: "",
    isActive: true,
  });

  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  // Step 1: Load active vendors
  useEffect(() => {
    tempUserService.getVendorsForProject(projectId).then(setVendors);
  }, [projectId]);

  // Load WOs when vendor changes
  useEffect(() => {
    if (form.vendorId) {
      tempUserService
        .getWorkOrders(Number(form.vendorId), projectId)
        .then(setWorkOrders);
      setForm((f) => ({ ...f, workOrderId: "" }));
    }
  }, [form.vendorId, projectId]);

  // Step 3: Load active templates
  useEffect(() => {
    if (step === 3 && templates.length === 0) {
      tempUserService.getTemplates().then((data) => {
        setTemplates(data.filter((t) => t.isActive));
      });
    }
  }, [step]);

  const handleCreate = async () => {
    try {
      const res = await tempUserService.createTempUser({
        ...form,
        vendorId: Number(form.vendorId),
        workOrderId: Number(form.workOrderId),
        projectId: Number(projectId),
        templateId: Number(form.templateId),
        password: form.password || undefined,
        isActive: form.isActive,
      });
      setCreatedPassword(form.password || res.generatedPassword);
    } catch (e: any) {
      alert(e.response?.data?.message || "Error creating user");
    }
  };

  const selectedTemplate = templates.find(
    (t) => t.id === Number(form.templateId),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm p-4">
      <div className="bg-surface-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-indigo-900 px-6 py-4 flex justify-between items-center text-white">
          <h2 className="text-xl font-bold">Create Temporary Vendor User</h2>
          {!createdPassword && (
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white transition-colors text-2xl font-light"
            >
              &times;
            </button>
          )}
        </div>

        {/* Password Screen */}
        {createdPassword ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 text-success rounded-full flex items-center justify-center mb-2">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                User Created Successfully!
              </h3>
              <p className="text-text-secondary">
                Please share these credentials with the vendor securely. They
                will be forced to change the password on first login.
              </p>
            </div>

            <div className="bg-surface-base border border-border-default rounded-xl p-6 w-full max-w-sm space-y-4">
              <div>
                <p className="text-xs text-text-muted uppercase font-semibold tracking-wider">
                  Username
                </p>
                <div className="font-mono text-lg text-gray-800 select-all p-2 bg-surface-card rounded border border-border-subtle">
                  {form.mobile}
                </div>
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase font-semibold tracking-wider">
                  Temporary Password
                </p>
                <div className="font-mono text-xl text-indigo-700 select-all p-2 bg-secondary-muted rounded border border-indigo-100">
                  {createdPassword}
                </div>
              </div>
            </div>

            <button
              onClick={onSuccess}
              className="mt-6 w-full max-w-sm bg-secondary hover:bg-secondary-dark text-white font-medium py-3 rounded-xl shadow-md transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Progress Steps */}
            <div className="bg-surface-base border-b border-border-subtle px-6 py-3">
              <div className="flex justify-between items-center text-sm font-medium">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                        step === s
                          ? "bg-secondary border-secondary text-white shadow-md"
                          : step > s
                            ? "bg-indigo-100 border-secondary text-secondary"
                            : "bg-surface-card border-border-strong text-text-disabled"
                      }`}
                    >
                      {s < step ? "✓" : s}
                    </div>
                    {s !== 4 && (
                      <div
                        className={`w-12 h-1 mx-2 rounded-full ${step > s ? "bg-secondary" : "bg-gray-200"}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-8 flex-1 overflow-y-auto">
              {/* Step 1: Work Order & Vendor */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">
                      Contractor Selection
                    </h3>
                    <p className="text-sm text-text-muted mb-6">
                      Select an active vendor and their corresponding work
                      order.
                    </p>

                    <label className="block text-sm font-semibold text-text-secondary mb-2">
                      Select Vendor *
                    </label>
                    <select
                      value={form.vendorId}
                      onChange={(e) =>
                        setForm({ ...form, vendorId: e.target.value })
                      }
                      className="w-full border-border-strong rounded-lg shadow-sm focus:ring-secondary focus:border-secondary py-3"
                    >
                      <option value="">-- Choose Vendor --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {form.vendorId && (
                    <div className="animate-fade-in">
                      <label className="block text-sm font-semibold text-text-secondary mb-2 mt-6">
                        Select Work Order *
                      </label>
                      <select
                        value={form.workOrderId}
                        onChange={(e) =>
                          setForm({ ...form, workOrderId: e.target.value })
                        }
                        className="w-full border-border-strong rounded-lg shadow-sm focus:ring-secondary focus:border-secondary py-3"
                      >
                        <option value="">-- Choose Work Order --</option>
                        {workOrders.map((wo) => (
                          <option key={wo.id} value={wo.id}>
                            {wo.woNumber} (Valid till {wo.orderValidityEnd})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: User Details */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">
                    User Details
                  </h3>
                  <p className="text-sm text-text-muted mb-6">
                    Enter the contractor representative's details. The mobile
                    number will be their username.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={form.fullName}
                        onChange={(e) =>
                          setForm({ ...form, fullName: e.target.value })
                        }
                        className="w-full rounded-lg border-border-strong shadow-sm focus:border-secondary focus:ring-secondary"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Mobile Number (Username) *
                      </label>
                      <input
                        type="text"
                        value={form.mobile}
                        onChange={(e) =>
                          setForm({ ...form, mobile: e.target.value })
                        }
                        className="w-full rounded-lg border-border-strong shadow-sm focus:border-secondary focus:ring-secondary font-mono"
                        placeholder="+91..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Designation
                      </label>
                      <input
                        type="text"
                        value={form.designation}
                        onChange={(e) =>
                          setForm({ ...form, designation: e.target.value })
                        }
                        className="w-full rounded-lg border-border-strong shadow-sm focus:border-secondary focus:ring-secondary"
                        placeholder="Site Engineer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Email{" "}
                        <span className="text-text-disabled font-normal">
                          (Optional)
                        </span>
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        className="w-full rounded-lg border-border-strong shadow-sm focus:border-secondary focus:ring-secondary"
                        placeholder="john@vendor.com"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border-subtle grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                        Security & Status
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Set Manual Password (Optional)
                      </label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        className="w-full rounded-lg border-border-strong shadow-sm focus:border-secondary focus:ring-secondary"
                        placeholder="Leave blank for auto-generate"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        id="isActive"
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) =>
                          setForm({ ...form, isActive: e.target.checked })
                        }
                        className="h-5 w-5 text-secondary border-border-strong rounded focus:ring-secondary"
                      />
                      <label
                        htmlFor="isActive"
                        className="text-sm font-medium text-text-secondary"
                      >
                        Set as Active
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Access Role */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">
                      Access Assignment
                    </h3>
                    <p className="text-sm text-text-muted mb-6">
                      Select a pre-defined role template configured by the
                      system administrator.
                    </p>

                    <label className="block text-sm font-semibold text-text-secondary mb-2">
                      Role Template *
                    </label>
                    <select
                      value={form.templateId}
                      onChange={(e) =>
                        setForm({ ...form, templateId: e.target.value })
                      }
                      className="w-full border-border-strong rounded-lg shadow-sm focus:ring-secondary focus:border-secondary py-3"
                    >
                      <option value="">-- Choose Template --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplate && (
                    <div className="bg-secondary-muted rounded-xl p-5 border border-indigo-100 animate-fade-in">
                      <h4 className="font-semibold text-indigo-900 mb-2">
                        Capabilities in `{selectedTemplate.name}`
                      </h4>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {selectedTemplate.allowedPermissions.map((code) => {
                          const flatPerms = Object.values(
                            TEMP_USER_ASSIGNABLE_PERMISSIONS,
                          ).flat();
                          const found = flatPerms.find((p) => p.key === code);
                          return (
                            <span
                              key={code}
                              className="inline-flex items-center px-2.5 py-1 rounded bg-surface-card text-indigo-700 text-xs font-medium border border-indigo-200"
                            >
                              ✓ {found ? found.label : code}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Review */}
              {step === 4 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">
                    Review & Confirm
                  </h3>
                  <p className="text-sm text-text-muted mb-4">
                    Please verify all details before generating credentials.
                  </p>

                  <div className="bg-surface-base border border-border-default rounded-xl overflow-hidden divide-y divide-slate-100">
                    <div className="p-4 flex gap-4">
                      <div className="w-1/3 text-sm text-text-muted">
                        FullName
                      </div>
                      <div className="w-2/3 text-sm font-medium text-slate-900">
                        {form.fullName}
                      </div>
                    </div>
                    <div className="p-4 flex gap-4">
                      <div className="w-1/3 text-sm text-text-muted">
                        Username / Phone
                      </div>
                      <div className="w-2/3 text-sm font-medium text-slate-900 font-mono">
                        {form.mobile}
                      </div>
                    </div>
                    <div className="p-4 flex gap-4">
                      <div className="w-1/3 text-sm text-text-muted">
                        Vendor
                      </div>
                      <div className="w-2/3 text-sm font-medium text-slate-900">
                        {
                          vendors.find((v) => String(v.id) === form.vendorId)
                            ?.name
                        }
                      </div>
                    </div>
                    <div className="p-4 flex gap-4">
                      <div className="w-1/3 text-sm text-text-muted">
                        Work Order No.
                      </div>
                      <div className="w-2/3 text-sm font-medium text-slate-900 font-mono">
                        {
                          workOrders.find(
                            (wo) => String(wo.id) === form.workOrderId,
                          )?.woNumber
                        }
                      </div>
                    </div>
                    <div className="p-4 flex gap-4">
                      <div className="w-1/3 text-sm text-text-muted">
                        Assigned Role
                      </div>
                      <div className="w-2/3 text-sm font-medium text-indigo-700 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-secondary mr-2"></span>
                        {selectedTemplate?.name}
                      </div>
                    </div>
                  </div>

                  <div className="bg-warning-muted rounded-lg p-4 border border-amber-200 text-sm text-amber-800 flex items-start">
                    <svg
                      className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-amber-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                    A temporary password will be shown on the next screen. You
                    must safely copy it now, it will not be displayed again.
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 bg-surface-base border-t border-border-subtle flex justify-between items-center rounded-b-2xl">
              <button
                onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
                className="px-6 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                {step > 1 ? "← Back" : "Cancel"}
              </button>

              <button
                disabled={
                  (step === 1 && (!form.vendorId || !form.workOrderId)) ||
                  (step === 2 && (!form.fullName || !form.mobile)) ||
                  (step === 3 && !form.templateId)
                }
                onClick={() => {
                  if (step < 4) setStep(step + 1);
                  else handleCreate();
                }}
                className="bg-secondary hover:bg-secondary-dark disabled:bg-indigo-300 text-white font-medium py-2.5 px-8 rounded-xl shadow-md transition-all flex items-center"
              >
                {step < 4 ? "Continue →" : "Generate User & Password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
