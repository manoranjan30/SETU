import { useEffect, useState } from "react";
import { Download, Loader2, QrCode, Smartphone, AlertCircle } from "lucide-react";
import api from "../api/axios";

interface MobileAppInfo {
  latestVersion?: string;
  downloadUrl?: string | null;
  qrCodeDataUrl?: string | null;
  apkOriginalName?: string | null;
  apkFileSize?: number | string | null;
  apkUploadedAt?: string | null;
}

const MobileAppDownloadPage = () => {
  const [info, setInfo] = useState<MobileAppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const response = await api.get("/app/mobile-app", {
          params: { platform: "android" },
          headers: { "X-Setu-Silent-Loader": "true" },
        });
        setInfo(response.data);
      } catch {
        setError("Mobile app download details are not available right now.");
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, []);

  const formatFileSize = (value?: number | string | null) => {
    const size = Number(value || 0);
    if (!size) return "Not available";
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.ceil(size / 1024)} KB`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center p-6">
        <div className="flex items-center gap-3 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading mobile app details...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-info-muted text-primary">
          <Smartphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mobile App</h1>
          <p className="text-sm text-text-muted">
            Download the latest Android app package.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-error-muted p-4 text-red-700">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-lg border border-border-default bg-surface-card p-6 shadow-sm">
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">
                Version
              </p>
              <p className="mt-1 text-base font-semibold text-text-primary">
                {info?.latestVersion || "Not available"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">
                File Size
              </p>
              <p className="mt-1 text-base font-semibold text-text-primary">
                {formatFileSize(info?.apkFileSize)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">
                Uploaded
              </p>
              <p className="mt-1 text-base font-semibold text-text-primary">
                {info?.apkUploadedAt
                  ? new Date(info.apkUploadedAt).toLocaleDateString()
                  : "Not available"}
              </p>
            </div>
          </div>

          {info?.downloadUrl ? (
            <div className="space-y-4">
              <a
                href={info.downloadUrl}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                <Download size={18} />
                Download APK
              </a>
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Shared download link
                </label>
                <input
                  readOnly
                  value={info.downloadUrl}
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-secondary"
                />
              </div>
              <p className="text-sm text-text-muted">
                {info.apkOriginalName || "SETU mobile application package"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border-default bg-surface-base p-5 text-sm text-text-muted">
              The mobile APK has not been uploaded yet.
            </div>
          )}
        </section>

        <section className="flex flex-col items-center rounded-lg border border-border-default bg-surface-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <QrCode size={18} />
            Scan to Download
          </div>
          {info?.qrCodeDataUrl ? (
            <img
              src={info.qrCodeDataUrl}
              alt="Mobile app download QR code"
              className="h-56 w-56 rounded-md bg-white p-3"
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-md bg-surface-base text-center text-sm text-text-muted">
              QR code will appear after APK upload.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MobileAppDownloadPage;
