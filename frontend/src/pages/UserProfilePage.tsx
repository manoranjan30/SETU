import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Camera,
  Save,
  Fingerprint,
  RefreshCw,
  Lock,
  Upload,
  Check,
  X,
} from "lucide-react";
import api from "../api/axios";
import { getPublicFileUrl } from "../api/baseUrl";
import SignatureCanvas from "react-signature-canvas";
import { ThemePicker } from "../components/common/ThemePicker";
import { useTheme } from "../context/ThemeContext";
import { themeLabels } from "../theme/tokens";

function getApiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response
      ?.data?.message === "string"
  ) {
    return (error as { response: { data: { message: string } } }).response.data
      .message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function normalizeSignatureSource(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^data:image\//i.test(text)) return text;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^\/?uploads\//i.test(text)) return getPublicFileUrl(text);
  if (/^[A-Za-z0-9+/=\s]+$/.test(text) && text.length > 100) {
    return `data:image/png;base64,${text.replace(/\s+/g, "")}`;
  }
  return text;
}

interface UserProfile {
  username?: string;
  displayName?: string;
  email?: string;
  designation?: string;
  phone?: string;
  role?: string;
}

/** Manual trim: extracts just the drawn area from a canvas, bypassing broken trim-canvas dep */
function trimCanvasToDataUrl(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  let top = height,
    left = width,
    right = 0,
    bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (right <= left || bottom <= top) return canvas.toDataURL("image/png");
  const pad = 10;
  const tLeft = Math.max(0, left - pad);
  const tTop = Math.max(0, top - pad);
  const tWidth = Math.min(width, right - left + pad * 2);
  const tHeight = Math.min(height, bottom - top + pad * 2);
  const trimmed = document.createElement("canvas");
  trimmed.width = tWidth;
  trimmed.height = tHeight;
  trimmed
    .getContext("2d")!
    .putImageData(ctx.getImageData(tLeft, tTop, tWidth, tHeight), 0, 0);
  return trimmed.toDataURL("image/png");
}

async function extractSignatureFromImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Upload a JPG, PNG, or WebP signature image.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Signature image must be 5 MB or smaller.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error("Unable to read signature image."));
      next.src = objectUrl;
    });
    const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Image processing is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const luminanceHistogram = new Uint32Array(256);
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const luminance = Math.max(
        0,
        Math.min(
          255,
          Math.round(
            pixels[offset] * 0.299 +
              pixels[offset + 1] * 0.587 +
              pixels[offset + 2] * 0.114,
          ),
        ),
      );
      luminanceHistogram[luminance] += 1;
    }
    const percentile = (ratio: number) => {
      const target = canvas.width * canvas.height * ratio;
      let count = 0;
      for (let value = 0; value < luminanceHistogram.length; value += 1) {
        count += luminanceHistogram[value];
        if (count >= target) return value;
      }
      return 255;
    };
    const darkLevel = percentile(0.02);
    const paperLevel = percentile(0.75);
    const contrast = Math.max(1, paperLevel - darkLevel);
    const inkThreshold = Math.min(
      paperLevel - 24,
      darkLevel + Math.max(34, contrast * 0.42),
    );
    const featherWidth = Math.max(12, Math.min(38, contrast * 0.18));
    let left = canvas.width;
    let top = canvas.height;
    let right = -1;
    let bottom = -1;
    let foregroundPixels = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const offset = (y * canvas.width + x) * 4;
        const luminance =
          pixels[offset] * 0.299 +
          pixels[offset + 1] * 0.587 +
          pixels[offset + 2] * 0.114;
        const alpha = Math.max(
          0,
          Math.min(
            255,
            Math.round(((inkThreshold + featherWidth - luminance) / featherWidth) * 255),
          ),
        );
        pixels[offset] = 18;
        pixels[offset + 1] = 18;
        pixels[offset + 2] = 18;
        pixels[offset + 3] = alpha;
        if (alpha > 72) {
          foregroundPixels += 1;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }
    if (right < left || bottom < top) {
      throw new Error(
        "No signature was detected. Use dark ink on clean white paper.",
      );
    }
    const foregroundRatio =
      foregroundPixels / Math.max(1, canvas.width * canvas.height);
    if (foregroundRatio > 0.3) {
      throw new Error(
        "The paper background could not be separated from the signature. Retake the photo in brighter, even lighting with the paper filling the frame.",
      );
    }
    context.putImageData(imageData, 0, 0);
    const padding = 18;
    const cropX = Math.max(0, left - padding);
    const cropY = Math.max(0, top - padding);
    const cropWidth = Math.min(
      canvas.width - cropX,
      right - left + 1 + padding * 2,
    );
    const cropHeight = Math.min(
      canvas.height - cropY,
      bottom - top + 1 + padding * 2,
    );
    const output = document.createElement("canvas");
    output.width = cropWidth;
    output.height = cropHeight;
    output
      .getContext("2d")!
      .drawImage(
        canvas,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      );
    return output.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function UserProfilePage() {
  const { theme } = useTheme();
  const [profile, setProfile] = useState<UserProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Signature state
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | null>(null);
  const [signatureUpdatedAt, setSignatureUpdatedAt] = useState<string | null>(
    null,
  );
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const [uploadedSignaturePreview, setUploadedSignaturePreview] = useState<
    string | null
  >(null);
  const [processingSignature, setProcessingSignature] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [profRes, sigRes] = await Promise.all([
          api.get("/users/me"),
          api.get("/users/me/signature"),
        ]);
        setProfile(profRes.data);
        if (sigRes.data?.signatureData || sigRes.data?.signatureImageUrl) {
          setSignatureData(normalizeSignatureSource(sigRes.data.signatureData));
          setSignatureImageUrl(
            normalizeSignatureSource(sigRes.data.signatureImageUrl),
          );
          setSignatureUpdatedAt(sigRes.data.signatureUpdatedAt);
        }
      } catch (error) {
        console.error("Failed to load profile data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await api.put("/users/me", {
        displayName: profile.displayName,
        email: profile.email,
        designation: profile.designation,
        phone: profile.phone,
      });
      alert("Profile updated successfully.");
    } catch (error) {
      alert(getApiErrorMessage(error, "Failed to update profile."));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      alert("Please enter your current password.");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      alert("New password must be at least 8 characters long.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("New password and confirmation do not match.");
      return;
    }

    try {
      setPasswordSaving(true);
      await api.put("/users/me/password", {
        oldPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      alert("Password updated successfully.");
    } catch (error) {
      alert(getApiErrorMessage(error, "Failed to update password."));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSaveSignature = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      return alert("Please draw a signature first.");
    }
    try {
      setSaving(true);
      const dataUrl = trimCanvasToDataUrl(sigCanvas.current.getCanvas());
      await api.put("/users/me/signature", { signatureData: dataUrl });
      setSignatureData(dataUrl);
      setSignatureImageUrl(null);
      setSignatureUpdatedAt(new Date().toISOString());
      sigCanvas.current.clear();
      alert("Digital signature stored securely.");
    } catch (error) {
      console.error("Signature save error:", error);
      const msg = getApiErrorMessage(error, "Failed to update signature.");
      const status =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { status?: unknown } }).response
          ?.status === "number"
          ? ` (Status: ${(error as { response: { status: number } }).response.status})`
          : "";
      alert(`${msg}${status}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setProcessingSignature(true);
    try {
      setUploadedSignaturePreview(await extractSignatureFromImage(file));
    } catch (error) {
      alert(getApiErrorMessage(error, "Failed to process signature image."));
    } finally {
      setProcessingSignature(false);
    }
  };

  const confirmUploadedSignature = async () => {
    if (!uploadedSignaturePreview) return;
    try {
      setSaving(true);
      await api.put("/users/me/signature", {
        signatureData: uploadedSignaturePreview,
      });
      setSignatureData(uploadedSignaturePreview);
      setSignatureImageUrl(null);
      setSignatureUpdatedAt(new Date().toISOString());
      setUploadedSignaturePreview(null);
      alert("Cleaned digital signature stored securely.");
    } catch (error) {
      alert(getApiErrorMessage(error, "Failed to update signature."));
    } finally {
      setSaving(false);
    }
  };

  const currentSignatureSource =
    normalizeSignatureSource(signatureData) ||
    normalizeSignatureSource(signatureImageUrl);

  const clearCanvas = () => {
    sigCanvas.current?.clear();
  };

  if (loading)
    return <div className="p-8 text-text-muted">Loading profile...</div>;

  return (
    <div className="max-w-4xl flex gap-8 animate-in fade-in p-8">
      <div className="w-2/3 space-y-6">
        <div className="bg-surface-card rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-secondary" />
            Personal Information
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Display Name
              </label>
              <input
                name="displayName"
                value={profile.displayName || ""}
                onChange={handleProfileChange}
                className="w-full bg-surface-base border-border-default rounded-lg p-3 text-sm focus:ring-2 focus:ring-secondary font-medium"
                placeholder="E.g., John Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                name="email"
                type="email"
                value={profile.email || ""}
                onChange={handleProfileChange}
                className="w-full bg-surface-base border-border-default rounded-lg p-3 text-sm focus:ring-2 focus:ring-secondary font-medium"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Designation
              </label>
              <input
                name="designation"
                value={profile.designation || ""}
                onChange={handleProfileChange}
                className="w-full bg-surface-base border-border-default rounded-lg p-3 text-sm focus:ring-2 focus:ring-secondary font-medium"
                placeholder="Site Engineer, QC Manager"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Phone
              </label>
              <input
                name="phone"
                value={profile.phone || ""}
                onChange={handleProfileChange}
                className="w-full bg-surface-base border-border-default rounded-lg p-3 text-sm focus:ring-2 focus:ring-secondary font-medium"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center gap-2 bg-secondary hover:bg-secondary-dark text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all"
            >
              <Save className="w-4 h-4" />{" "}
              {saving ? "Saving..." : "Save Details"}
            </button>
          </div>
        </div>

        <div className="bg-surface-card rounded-2xl shadow-sm border p-6">
          <div className="mb-6 rounded-xl border border-indigo-100 bg-secondary-muted/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Appearance
            </div>
            <div className="mt-1 text-sm text-text-secondary">
              Active Theme:{" "}
              <span className="font-semibold text-text-primary">
                {themeLabels[theme]}
              </span>
            </div>
          </div>

          <ThemePicker />
        </div>

        <div className="bg-surface-card rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-rose-500" />
            Change Password
          </h2>
          <p className="text-sm text-text-muted mb-6">
            Update your password here. Use at least 8 characters for a secure
            login.
          </p>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Current Password
              </label>
              <input
                name="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={handlePasswordInputChange}
                className="w-full bg-surface-base border-border-default rounded-lg p-3 text-sm focus:ring-2 focus:ring-secondary font-medium"
                placeholder="Enter your current password"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                New Password
              </label>
              <input
                name="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={handlePasswordInputChange}
                className="w-full bg-surface-base border-border-default rounded-lg p-3 text-sm focus:ring-2 focus:ring-secondary font-medium"
                placeholder="Enter a new password"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Confirm New Password
              </label>
              <input
                name="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordInputChange}
                className="w-full bg-surface-base border-border-default rounded-lg p-3 text-sm focus:ring-2 focus:ring-secondary font-medium"
                placeholder="Re-enter the new password"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={passwordSaving}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all"
            >
              <Lock className="w-4 h-4" />
              {passwordSaving ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>

        <div className="bg-surface-card rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
            <Fingerprint className="w-5 h-5 text-amber-500" />
            Digital Signature
          </h2>
          <p className="text-sm text-text-muted mb-6">
            Your digital signature is used for signing off RFIs and workflow
            approvals. Draw it below or upload a photograph of a signature
            written with dark ink on white paper.
          </p>

          <div className="flex gap-6">
            <div className="flex-1">
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Update Signature
              </label>
              <div className="border-2 border-dashed border-border-strong rounded-xl bg-surface-base relative overflow-hidden group h-40">
                <SignatureCanvas
                  ref={sigCanvas}
                  penColor="blue"
                  canvasProps={{ className: "w-full h-full cursor-crosshair" }}
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={clearCanvas}
                    className="bg-surface-card text-text-secondary p-1.5 rounded-lg shadow-sm border border-border-default hover:bg-surface-base flex items-center gap-1 text-xs font-medium"
                  >
                    <RefreshCw size={14} /> Clear
                  </button>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveSignature}
                  disabled={saving}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all"
                >
                  <Save className="w-4 h-4" /> Save New Signature
                </button>
              </div>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border-default" />
                <span className="text-xs font-semibold uppercase text-text-muted">
                  or
                </span>
                <div className="h-px flex-1 bg-border-default" />
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-card px-4 py-3 text-sm font-bold text-text-secondary hover:bg-surface-raised">
                <Upload className="h-4 w-4" />
                {processingSignature
                  ? "Cleaning signature..."
                  : "Upload signature from paper"}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  disabled={processingSignature || saving}
                  onChange={handleSignatureImageUpload}
                />
              </label>
              <p className="mt-2 text-xs text-text-muted">
                The white paper background is removed locally. Review the
                cleaned signature before confirming.
              </p>
              {uploadedSignaturePreview && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-3 text-xs font-bold uppercase text-amber-800">
                    Confirm cleaned signature
                  </div>
                  <div
                    className="flex h-32 items-center justify-center rounded-lg border border-amber-200 p-3"
                    style={{
                      backgroundColor: "#ffffff",
                      backgroundImage:
                        "linear-gradient(45deg, #eef2f7 25%, transparent 25%), linear-gradient(-45deg, #eef2f7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eef2f7 75%), linear-gradient(-45deg, transparent 75%, #eef2f7 75%)",
                      backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                      backgroundSize: "16px 16px",
                    }}
                  >
                    <img
                      src={uploadedSignaturePreview}
                      alt="Cleaned signature preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setUploadedSignaturePreview(null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-default px-3 py-2 text-xs font-bold text-text-secondary"
                    >
                      <X className="h-3.5 w-3.5" /> Discard
                    </button>
                    <button
                      type="button"
                      onClick={confirmUploadedSignature}
                      disabled={saving}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Confirm and Save
                    </button>
                  </div>
                </div>
              )}
            </div>

            {currentSignatureSource && (
              <div className="w-1/3">
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                  Current Signature
                </label>
                <div
                  className="border border-border-default rounded-xl p-4 flex flex-col items-center justify-center h-40"
                  style={{
                    backgroundColor: "#ffffff",
                    backgroundImage:
                      "linear-gradient(45deg, #eef2f7 25%, transparent 25%), linear-gradient(-45deg, #eef2f7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eef2f7 75%), linear-gradient(-45deg, transparent 75%, #eef2f7 75%)",
                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                    backgroundSize: "16px 16px",
                  }}
                >
                  <img
                    src={currentSignatureSource}
                    alt="Current Signature"
                    className="max-h-full max-w-full object-contain mix-blend-multiply"
                  />
                </div>
                {signatureUpdatedAt && (
                  <p className="text-[10px] text-text-disabled text-center mt-2">
                    Last updated:{" "}
                    {new Date(signatureUpdatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-1/3">
        <div className="bg-gradient-to-br from-secondary flex-col items-center to-purple-600 rounded-2xl shadow-lg p-6 text-white text-center">
          <div className="w-24 h-24 bg-surface-card/20 rounded-full mx-auto flex items-center justify-center mb-4 ring-4 ring-white/10 backdrop-blur-sm relative overflow-hidden group">
            <span className="text-4xl font-black">
              {profile.displayName?.charAt(0) ||
                profile.username?.charAt(0) ||
                "U"}
            </span>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-xl font-bold">
            {profile.displayName || profile.username}
          </h3>
          <p className="text-white/80 text-sm font-medium mt-1">
            {profile.role}
          </p>

          <div className="mt-8 pt-6 border-t border-white/20 text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-card/10 rounded-lg">
                <Mail className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium">
                {profile.email || "No email provided"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-card/10 rounded-lg">
                <Phone className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium">
                {profile.phone || "No phone provided"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-card/10 rounded-lg">
                <Briefcase className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium">
                {profile.designation || "No designation"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
