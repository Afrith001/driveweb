import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Presentation,
} from "lucide-react";
import { kindOf } from "@/lib/drive-client";

export function FileTypeIcon({
  mimeType,
  isFolder,
  className,
}: {
  mimeType: string;
  isFolder?: boolean;
  className?: string;
}) {
  if (isFolder) return <Folder className={className} fill="currentColor" strokeWidth={1.5} />;
  const kind = kindOf(mimeType);
  if (kind === "Document") {
    return <span className={`${className ?? ""} font-bold text-blue-600`} aria-hidden="true">W</span>;
  }
  if (kind === "PDF") {
    return <span className={`${className ?? ""} font-bold text-red-600`} aria-hidden="true">PDF</span>;
  }
  if (kind === "Spreadsheet") {
    return <span className={`${className ?? ""} font-bold text-green-600`} aria-hidden="true">X</span>;
  }
  if (kind === "Presentation") {
    return <span className={`${className ?? ""} font-bold text-orange-600`} aria-hidden="true">P</span>;
  }
  switch (kind) {
    case "Video":
      return <FileVideo className={className} />;
    case "Image":
      return <FileImage className={className} />;
    case "Audio":
      return <FileAudio className={className} />;
    case "PDF":
    case "Text":
    case "Document":
      return <FileText className={className} />;
    case "Spreadsheet":
      return <FileSpreadsheet className={className} />;
    case "Presentation":
      return <Presentation className={className} />;
    case "Archive":
      return <FileArchive className={className} />;
    default:
      return <FileIcon className={className} />;
  }
}
