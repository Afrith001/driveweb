import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FolderPlus,
  HardDrive,
  Loader2,
  MoreVertical,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { PreviewDialog } from "@/components/PreviewDialog";
import {
  createFolder,
  deleteItem,
  fetchConfigured,
  fetchFolders,
  fetchItems,
  formatDate,
  formatSize,
  moveItem,
  renameItem,
  uploadFile,
  type Crumb,
  type DriveItem,
} from "@/lib/drive-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Drive — Personal Google Drive File Manager" },
      {
        name: "description",
        content:
          "Upload videos, images, PDFs and documents straight to your Google Drive, organised by folders and dates.",
      },
      { property: "og:title", content: "My Drive — Personal Google Drive File Manager" },
      {
        property: "og:description",
        content:
          "Upload videos, images, PDFs and documents straight to your Google Drive, organised by folders and dates.",
      },
    ],
  }),
  component: DriveManager,
});

type UploadTask = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

function DriveManager() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([]);
  const [search, setSearch] = useState("");
  const [dateFolders, setDateFolders] = useState(true);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const [preview, setPreview] = useState<DriveItem | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DriveItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<DriveItem | null>(null);
  const [renameName, setRenameName] = useState("");
  const [moveTarget, setMoveTarget] = useState<DriveItem | null>(null);

  const config = useQuery({ queryKey: ["config"], queryFn: fetchConfigured });

  const listing = useQuery({
    queryKey: ["items", folderId],
    queryFn: async () => {
      const data = await fetchItems(folderId);
      const uniqueBreadcrumb = data.breadcrumb.filter(
        (crumb, index, crumbs) =>
          crumbs.findIndex((candidate) => candidate.id === crumb.id) === index,
      );
      if (uniqueBreadcrumb[0]?.name === "My Drive") uniqueBreadcrumb.shift();
      setBreadcrumb(uniqueBreadcrumb);
      return data.items;
    },
    enabled: config.data?.authorized === true,
  });

  const items = listing.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, search]);
  const folders = filtered.filter((i) => i.isFolder);
  const files = filtered.filter((i) => !i.isFolder);

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ["items"] });
  }, [queryClient]);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const selected = Array.from(fileList);
      const tasks: UploadTask[] = selected.map((f) => ({
        id: `${f.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: f.name,
        progress: 0,
        status: "uploading",
      }));
      setUploads((prev) => [...tasks, ...prev]);

      for (let i = 0; i < selected.length; i++) {
        const file = selected[i]!;
        const task = tasks[i]!;
        try {
          await uploadFile(file, { parentId: folderId, useDateFolder: !folderId && dateFolders }, (p) =>
            setUploads((prev) =>
              prev.map((t) => (t.id === task.id ? { ...t, progress: p } : t)),
            ),
          );
          setUploads((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, progress: 100, status: "done" } : t,
            ),
          );
          await refresh();
          window.setTimeout(() => {
            setUploads((prev) => prev.filter((t) => t.id !== task.id));
          }, 1500);
          toast.success(`Uploaded ${file.name}`);
        } catch (e) {
          const message = (e as Error).message;
          setUploads((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, status: "error", error: message } : t)),
          );
          toast.error(message);
        }
      }
    },
    [folderId, dateFolders, refresh],
  );

  const folderMutation = useMutation({
    mutationFn: (name: string) => createFolder(name, folderId),
    onSuccess: () => {
      toast.success("Folder created");
      setNewFolderOpen(false);
      setNewFolderName("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => {
      toast.success("Deleted");
      setPendingDelete(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameItem(id, name),
    onSuccess: () => {
      toast.success("Renamed");
      setRenameTarget(null);
      setRenameName("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, destinationId }: { id: string; destinationId: string }) =>
      moveItem(id, destinationId),
    onSuccess: () => {
      toast.success("Moved");
      setMoveTarget(null);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const folderPicker = useQuery({
    queryKey: ["folders"],
    queryFn: fetchFolders,
    enabled: !!moveTarget,
  });

  const activeUploads = uploads.filter((u) => u.status === "uploading").length;

  return (
    <div className="min-h-screen bg-background">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <HardDrive className="size-5" />
            <h1 className="text-base font-semibold tracking-tight">My Drive</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewFolderOpen(true)}
              disabled={!config.data?.authorized}
            >
              <FolderPlus className="size-4" />
              <span className="hidden sm:inline">New Folder</span>
            </Button>
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={!config.data?.authorized}>
              <Upload className="size-4" />
              Upload
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {config.isLoading && <Skeleton className="h-24 w-full" />}

        {config.data && !config.data.configured && <SetupNotice />}

        {config.data && config.data.configured && !config.data.authorized && (
          <AuthorizationNotice authType={config.data.authType} />
        )}

        {config.data?.authorized && (
          <>
            {/* Upload area */}
            <section
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFiles(e.dataTransfer.files);
              }}
              className="rounded-lg border border-dashed border-border bg-card p-6 text-center sm:p-10"
            >
              <Upload className="mx-auto size-6 text-muted-foreground" />
              <h2 className="mt-3 text-lg font-semibold tracking-tight">Upload Files</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Videos, images, PDFs, documents — drag and drop or choose files.
              </p>
              <Button className="mt-4" size="lg" onClick={() => inputRef.current?.click()}>
                <Upload className="size-4" />
                Upload Files
              </Button>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Switch
                  id="date-folders"
                  checked={dateFolders}
                  onCheckedChange={setDateFolders}
                />
                <Label htmlFor="date-folders" className="text-sm text-muted-foreground">
                  Organise uploads into date folders (YYYY-MM-DD)
                </Label>
              </div>
            </section>

            {/* Upload progress */}
            {uploads.length > 0 && (
              <section className="mt-4 space-y-2 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {activeUploads > 0 ? `Uploading ${activeUploads} file(s)` : "Uploads"}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setUploads([])}>
                    Clear
                  </Button>
                </div>
                {uploads.map((u) => (
                  <div key={u.id} className="flex items-center gap-3">
                    {u.status === "done" ? (
                      <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
                    ) : u.status === "error" ? (
                      <AlertCircle className="size-4 shrink-0 text-destructive" />
                    ) : (
                      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{u.name}</p>
                      {u.status === "error" ? (
                        <p className="text-xs text-destructive">{u.error}</p>
                      ) : (
                        <Progress value={u.progress} className="mt-1 h-1" />
                      )}
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                      {u.status === "error" ? "Failed" : `${u.progress}%`}
                    </span>
                  </div>
                ))}
              </section>
            )}

            {/* Toolbar */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm">
                <button
                  onClick={() => setFolderId(null)}
                  className="rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  My Drive
                </button>
                {breadcrumb.map((c, i) => (
                  <span key={c.id} className="flex items-center gap-1">
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                    <button
                      onClick={() => setFolderId(c.id)}
                      className={
                        i === breadcrumb.length - 1
                          ? "rounded px-1.5 py-0.5 font-medium"
                          : "rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
                      }
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
              </nav>
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search files…"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Listing */}
            {listing.isLoading ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            ) : listing.isError ? (
              <ErrorState
                message={(listing.error as Error).message}
                onRetry={() => void listing.refetch()}
              />
            ) : (
              <div className="mt-4 space-y-6">
                {folders.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Folders
                    </h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {folders.map((f) => (
                        <div
                          key={f.id}
                          className="group relative rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent"
                        >
                          <button
                            onClick={() => setFolderId(f.id)}
                            className="flex w-full min-w-0 flex-col items-center gap-2 text-center"
                          >
                            <span className="flex size-20 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/30">
                              <FileTypeIcon isFolder mimeType={f.mimeType} className="size-12" />
                            </span>
                            <span className="w-full truncate text-sm font-medium" title={f.name}>{f.name}</span>
                            <span className="text-[11px] text-muted-foreground">{formatDate(f.createdTime)}</span>
                          </button>
                          <div className="absolute right-1 top-1 flex opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Rename ${f.name}`}
                              onClick={() => {
                                setRenameTarget(f);
                                setRenameName(f.name);
                              }}
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Move ${f.name}`}
                              onClick={() => setMoveTarget(f)}
                              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${f.name}`}
                              onClick={() => setPendingDelete(f)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Files
                  </h3>
                  {files.length === 0 ? (
                    <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                      {search ? "No files match your search." : "This folder is empty."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {files.map((f) => (
                        <article
                          key={f.id}
                          className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-accent"
                        >
                          <button
                            onClick={() => setPreview(f)}
                            className="flex aspect-square w-full items-center justify-center overflow-hidden bg-muted/50"
                          >
                            {f.thumbnailLink || f.mimeType.startsWith("image/") ? (
                              <img
                                src={
                                  f.mimeType.startsWith("image/")
                                    ? `/api/files/${f.id}/preview`
                                    : (f.thumbnailLink as string)
                                }
                                alt={f.name}
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <FileTypeIcon
                                mimeType={f.mimeType}
                                className="size-14 text-muted-foreground"
                              />
                            )}
                          </button>
                          <div className="flex min-w-0 flex-1 items-center gap-2 p-3">
                            <p className="min-w-0 flex-1 truncate text-sm font-medium" title={f.name}>
                              {f.name}
                            </p>
                            <div className="flex min-w-0 flex-col items-end text-right">
                              <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
                              <span className="text-[11px] text-muted-foreground">{formatDate(f.createdTime)}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${f.name}`}
                              onClick={() => setPendingDelete(f)}
                              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>

      <PreviewDialog item={preview} onClose={() => setPreview(null)} />

      <Dialog open={!!moveTarget} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move file</DialogTitle>
            <DialogDescription>Select a destination folder for {moveTarget?.name}.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {folderPicker.isLoading && <Skeleton className="h-10 w-full" />}
            {folderPicker.isError && (
              <p className="text-sm text-destructive">{(folderPicker.error as Error).message}</p>
            )}
            {folderPicker.data?.map((folder) => (
              <Button
                key={folder.id}
                variant="ghost"
                className="w-full justify-start gap-3"
                disabled={folder.id === moveTarget?.id || moveMutation.isPending}
                onClick={() => moveTarget && moveMutation.mutate({ id: moveTarget.id, destinationId: folder.id })}
              >
                <FileTypeIcon isFolder mimeType={folder.mimeType} className="size-5 text-amber-500" />
                <span className="truncate">{folder.name}</span>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>Enter a new name for {renameTarget?.name}.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameTarget && renameName.trim()) {
                renameMutation.mutate({ id: renameTarget.id, name: renameName.trim() });
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button
              disabled={!renameName.trim() || renameMutation.isPending}
              onClick={() => renameTarget && renameMutation.mutate({ id: renameTarget.id, name: renameName.trim() })}
            >
              {renameMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Created inside {breadcrumb.at(-1)?.name ?? "My Drive"}.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newFolderName}
            placeholder="Folder name"
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim())
                folderMutation.mutate(newFolderName.trim());
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newFolderName.trim() || folderMutation.isPending}
              onClick={() => folderMutation.mutate(newFolderName.trim())}
            >
              {folderMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This moves the item to the trash in your Google Drive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertCircle className="mx-auto size-5 text-destructive" />
      <p className="mt-2 text-sm font-medium">Couldn’t load your Drive files</p>
      <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function AuthorizationNotice({ authType }: { authType: string }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6 text-center max-w-xl mx-auto mt-8 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto text-primary">
        <HardDrive className="size-6" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight mt-4">Authorize Google Drive</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The application is configured using OAuth, but needs authorization to access your Google Drive folder.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row justify-center">
        <Button size="lg" asChild className="gap-2">
          <a href="/api/auth/login">
            <Upload className="size-4 rotate-90" />
            Connect Google Account
          </a>
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Note: You will be redirected to Google to authorize access. Make sure your account has access to the configured Drive folder.
      </p>
    </section>
  );
}

function SetupNotice() {
  return (
    <section className="rounded-lg border border-border bg-card p-6 max-w-2xl mx-auto shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">Connect your Google Drive</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The server is missing Google Drive credentials. Please add the required environment variables to your <code>.env</code> file and restart the server.
      </p>
      
      <div className="mt-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Option A: Google OAuth (Recommended)</h3>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">Configure an OAuth 2.0 Client in Google Cloud Console.</p>
          <ul className="space-y-2">
            <li className="rounded border border-border bg-muted/40 p-3 font-mono text-xs">
              GOOGLE_CLIENT_ID — Client ID from your Google Cloud credentials page
            </li>
            <li className="rounded border border-border bg-muted/40 p-3 font-mono text-xs">
              GOOGLE_CLIENT_SECRET — Client secret matching the client ID
            </li>
            <li className="rounded border border-border bg-muted/40 p-3 font-mono text-xs">
              GOOGLE_DRIVE_FOLDER_ID — The ID from your Drive folder URL
            </li>
          </ul>
        </div>

        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground">Option B: Service Account</h3>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">Configure a Service Account key and share folder access.</p>
          <ul className="space-y-2">
            <li className="rounded border border-border bg-muted/40 p-3 font-mono text-xs">
              GOOGLE_SERVICE_ACCOUNT_EMAIL — The client_email from your service account JSON
            </li>
            <li className="rounded border border-border bg-muted/40 p-3 font-mono text-xs">
              GOOGLE_PRIVATE_KEY — The private_key value (keep the \n escapes)
            </li>
            <li className="rounded border border-border bg-muted/40 p-3 font-mono text-xs">
              GOOGLE_DRIVE_FOLDER_ID — The ID from your Drive folder URL, shared with the service account email as Editor
            </li>
          </ul>
        </div>
      </div>
      
      <p className="mt-6 text-xs text-muted-foreground">
        Detailed instructions are in the project's README.md file.
      </p>
    </section>
  );
}
