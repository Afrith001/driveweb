import { Download, ExternalLink } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { formatSize, type DriveItem } from "@/lib/drive-client";

export function PreviewDialog({
  item,
  onClose,
}: {
  item: DriveItem | null;
  onClose: () => void;
}) {
  const src = item ? `/api/files/${item.id}/preview` : "";
  const mime = item?.mimeType ?? "";

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {item && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(item.size)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild variant="ghost" size="icon" aria-label="Download">
                  <a href={`/api/files/${item.id}/download`}>
                    <Download className="size-4" />
                  </a>
                </Button>
                {item.webViewLink && (
                  <Button asChild variant="ghost" size="icon" aria-label="Open in Google Drive">
                    <a href={item.webViewLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className="flex max-h-[70vh] items-center justify-center overflow-auto bg-muted/40 p-4">
              {mime.startsWith("video/") ? (
                <video src={src} controls playsInline className="max-h-[65vh] w-full rounded" />
              ) : mime.startsWith("image/") ? (
                <img src={src} alt={item.name} className="max-h-[65vh] rounded object-contain" />
              ) : mime.startsWith("audio/") ? (
                <audio src={src} controls className="w-full" />
              ) : mime === "application/pdf" ? (
                <iframe src={src} title={item.name} className="h-[65vh] w-full rounded bg-card" />
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileTypeIcon
                    mimeType={mime}
                    className="size-10 text-muted-foreground"
                  />
                  <p className="text-sm text-muted-foreground">
                    No inline preview for this file type.
                  </p>
                  <Button asChild size="sm">
                    <a href={`/api/files/${item.id}/download`}>Download file</a>
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
