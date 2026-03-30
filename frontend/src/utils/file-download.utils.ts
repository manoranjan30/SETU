const NON_FILE_SAFE_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]+/g;
const MULTI_SPACE = /\s+/g;

export const sanitizeFileName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "export";

  return trimmed
    .replace(NON_FILE_SAFE_CHARACTERS, " ")
    .replace(MULTI_SPACE, " ")
    .trim()
    .replace(/\.+$/, "");
};

export const withFileExtension = (fileName: string, extension: string) => {
  const safeName = sanitizeFileName(fileName);
  const normalizedExtension = extension.startsWith(".")
    ? extension
    : `.${extension}`;

  return safeName.toLowerCase().endsWith(normalizedExtension.toLowerCase())
    ? safeName
    : `${safeName}${normalizedExtension}`;
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
