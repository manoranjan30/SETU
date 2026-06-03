import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import api from "../../api/axios";
import { apiBaseUrl } from "../../api/baseUrl";
import {
  Settings,
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Layout,
  FileText,
  Smartphone,
  Upload,
  QrCode,
  Download,
} from "lucide-react";

interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description: string;
  group: string;
}

interface MobileAppInfo {
  platform: string;
  latestVersion?: string;
  downloadUrl?: string | null;
  qrCodeDataUrl?: string | null;
  apkOriginalName?: string | null;
  apkFileSize?: number | string | null;
  apkUploadedAt?: string | null;
}

const SystemSettings = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [mobileAppInfo, setMobileAppInfo] = useState<MobileAppInfo | null>(
    null,
  );
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [apkUploading, setApkUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [settingsResponse, mobileAppResponse] = await Promise.all([
        axios.get(`${apiBaseUrl}/admin/settings`),
        api.get("/app/mobile-app", {
          params: { platform: "android" },
          headers: { "X-Setu-Silent-Loader": "true" },
        }),
      ]);
      setSettings(settingsResponse.data);
      setMobileAppInfo(mobileAppResponse.data);
      setLoading(false);
    } catch (e) {
      setError("Failed to load settings");
      setLoading(false);
    }
  };

  const handleToggle = async (key: string, currentValue: string) => {
    const newValue = currentValue === "true" ? "false" : "true";
    updateSetting(key, newValue);
  };

  const updateSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      await axios.post(`${apiBaseUrl}/admin/settings/${key}`, { value });
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value } : s)),
      );
      setSuccess(`Setting updated successfully`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError("Update failed");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(null);
    }
  };

  const handleApkUpload = async () => {
    if (!apkFile) {
      setError("Please select an APK file to upload");
      setTimeout(() => setError(null), 8000);
      return;
    }

    const formData = new FormData();
    formData.append("file", apkFile);
    setApkUploading(true);

    try {
      const response = await api.post("/app/mobile-app/apk", formData, {
        params: { platform: "android" },
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 10 * 60 * 1000,
      });
      setMobileAppInfo(response.data);
      setApkFile(null);
      setSuccess("Mobile APK uploaded successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      const status = e?.response?.status;
      const serverMessage = e?.response?.data?.message;
      const message = Array.isArray(serverMessage)
        ? serverMessage.join(", ")
        : serverMessage;
      setError(
        status === 413
          ? "APK upload failed because the server/proxy upload size limit is too low."
          : e?.code === "ECONNABORTED"
            ? "APK upload timed out. Please retry on a stable connection."
            : status === 401 || status === 403
              ? "APK upload failed because your session does not have admin permission."
              : message || "APK upload failed. Check server upload path and proxy limits.",
      );
      setTimeout(() => setError(null), 3000);
    } finally {
      setApkUploading(false);
    }
  };

  const formatFileSize = (value?: number | string | null) => {
    const size = Number(value || 0);
    if (!size) return "Not available";
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.ceil(size / 1024)} KB`;
  };

  if (loading)
    return (
      <div className="p-8 text-center text-text-muted">
        Loading Configuration...
      </div>
    );

  const designSettings = settings.filter((s) => s.group === "DESIGN");
  const generalSettings = settings.filter((s) => s.group === "GENERAL");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            System Configuration
          </h1>
          <p className="text-text-muted text-sm">
            Manage global features and server-side toggles
          </p>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-success-muted border border-green-200 text-green-700 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} />
          {success}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-error-muted border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-text-secondary">
              Mobile App Distribution
            </h2>
          </div>
          <div className="bg-surface-card rounded-xl shadow-sm border border-border-default p-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-secondary">
                    Android APK
                  </label>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="file"
                      accept=".apk,application/vnd.android.package-archive"
                      onChange={(event) =>
                        setApkFile(event.target.files?.[0] || null)
                      }
                      className="block w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-secondary file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleApkUpload}
                      disabled={apkUploading || !apkFile}
                      className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Upload size={16} />
                      {apkUploading ? "Uploading" : "Upload APK"}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-border-default bg-surface-base p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-secondary">
                    <Download size={16} />
                    Download URL
                  </div>
                  {mobileAppInfo?.downloadUrl ? (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        readOnly
                        value={mobileAppInfo.downloadUrl}
                        className="min-w-0 flex-1 rounded-md border border-border-default bg-white px-3 py-2 text-sm text-text-secondary"
                      />
                      <a
                        href={mobileAppInfo.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-border-default px-3 py-2 text-sm font-medium text-primary transition hover:bg-info-muted"
                      >
                        <Download size={16} />
                        Open
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">
                      Upload an APK to generate the shared download URL and QR code.
                    </p>
                  )}
                </div>

                <div className="grid gap-3 text-sm text-text-muted sm:grid-cols-3">
                  <div>
                    <span className="block font-medium text-text-secondary">
                      File
                    </span>
                    {mobileAppInfo?.apkOriginalName || "Not uploaded"}
                  </div>
                  <div>
                    <span className="block font-medium text-text-secondary">
                      Size
                    </span>
                    {formatFileSize(mobileAppInfo?.apkFileSize)}
                  </div>
                  <div>
                    <span className="block font-medium text-text-secondary">
                      Uploaded
                    </span>
                    {mobileAppInfo?.apkUploadedAt
                      ? new Date(mobileAppInfo.apkUploadedAt).toLocaleString()
                      : "Not available"}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-surface-base p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-secondary">
                  <QrCode size={16} />
                  QR Code
                </div>
                {mobileAppInfo?.qrCodeDataUrl ? (
                  <img
                    src={mobileAppInfo.qrCodeDataUrl}
                    alt="Mobile app download QR code"
                    className="h-40 w-40 rounded-md bg-white p-2"
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-md bg-white text-center text-xs text-text-muted">
                    No QR yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Design & CAD Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-text-secondary">
              Design & CAD Engine
            </h2>
          </div>
          <div className="bg-surface-card rounded-xl shadow-sm border border-border-default overflow-hidden">
            {designSettings.map((setting) => (
              <SettingItem
                key={setting.id}
                setting={setting}
                saving={saving === setting.key}
                onToggle={handleToggle}
                onUpdate={updateSetting}
              />
            ))}
          </div>
        </section>

        {/* General Section */}
        {generalSettings.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Layout className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-text-secondary">
                General Settings
              </h2>
            </div>
            <div className="bg-surface-card rounded-xl shadow-sm border border-border-default overflow-hidden">
              {generalSettings.map((setting) => (
                <SettingItem
                  key={setting.id}
                  setting={setting}
                  saving={saving === setting.key}
                  onToggle={handleToggle}
                  onUpdate={updateSetting}
                />
              ))}
            </div>
          </section>
        )}

        {/* Tools Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-text-disabled" />
            <h2 className="text-lg font-semibold text-text-secondary">Tools</h2>
          </div>
          <div className="bg-surface-card rounded-xl border border-border-default shadow-sm">
            <Link
              to="/dashboard/admin/template-builder"
              className="flex items-center gap-4 p-5 hover:bg-surface-base transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-info-muted flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-800">
                  PDF Template Builder
                </h3>
                <p className="text-sm text-text-muted">
                  Create and manage templates for extracting data from PDFs
                </p>
              </div>
              <span className="text-text-disabled">→</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

const SettingItem = ({ setting, saving, onToggle, onUpdate }: any) => (
  <div className="p-5 border-b last:border-0 hover:bg-surface-base transition-colors">
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1">
        <h3 className="font-mono text-sm font-bold text-gray-800 mb-1">
          {setting.key}
        </h3>
        <p className="text-sm text-text-muted leading-relaxed">
          {setting.description}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        {setting.value === "true" || setting.value === "false" ? (
          <button
            onClick={() => onToggle(setting.key, setting.value)}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${setting.value === "true" ? "bg-primary" : "bg-gray-200"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-surface-card transition-transform ${setting.value === "true" ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        ) : (
          <input
            type="text"
            defaultValue={setting.value}
            onBlur={(e) => onUpdate(setting.key, e.target.value)}
            className="w-20 px-2 py-1 text-sm border rounded bg-surface-base font-mono text-center"
          />
        )}
        {saving && (
          <span className="text-[10px] text-primary animate-pulse">
            Syncing...
          </span>
        )}
      </div>
    </div>
  </div>
);

export default SystemSettings;
