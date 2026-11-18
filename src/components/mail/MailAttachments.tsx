import { useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getMailAttachmentUrl } from "@/lib/lead-mailing.functions";
import { checkMailAttachments, MAIL_ATTACHMENT_EXTENSIONS } from "@/lib/lead-mailing";

export type PendingAttachment = { name: string; type: string; size: number; data: string };

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function fmtSize(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Knopf „Datei anhängen“ plus Liste der gewählten Dateien. */
export function AttachmentPicker({ value, onChange }: { value: PendingAttachment[]; onChange: (v: PendingAttachment[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list);
    const problem = checkMailAttachments([...value, ...files.map((f) => ({ name: f.name, size: f.size }))]);
    if (problem) { toast.error(problem); return; }
    const next = [...value];
    for (const f of files) next.push({ name: f.name, type: f.type || "application/octet-stream", size: f.size, data: await toBase64(f) });
    onChange(next);
  };
  return (
    <div className="space-y-2 min-w-0">
      <input ref={ref} type="file" multiple className="hidden" accept={MAIL_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",")}
        onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => ref.current?.click()}>
        <Paperclip className="h-4 w-4" /><span>Datei anhängen</span>
      </Button>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((a, i) => (
            <li key={`${a.name}-${i}`} className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{a.name}</span>
              <span className="shrink-0 text-muted-foreground">{fmtSize(a.size)}</span>
              <button type="button" aria-label={`${a.name} entfernen`} className="shrink-0" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Anhänge einer gespeicherten Nachricht zum Öffnen/Herunterladen. */
export function AttachmentList({ items }: { items: { name: string; size: number; path: string }[] | null | undefined }) {
  const urlFn = useServerFn(getMailAttachmentUrl);
  if (!items?.length) return null;
  const openFile = async (path: string) => {
    const w = window.open("", "_blank");
    try {
      const { url } = await urlFn({ data: { path } });
      if (w) w.location.href = url; else window.location.href = url;
    } catch (e: any) { w?.close(); toast.error(e?.message ?? "Anhang konnte nicht geöffnet werden"); }
  };
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((a) => (
        <button key={a.path} type="button" onClick={() => void openFile(a.path)}
          className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground hover:bg-accent">
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{a.name}</span>
          <span className="shrink-0 text-muted-foreground">{fmtSize(a.size)}</span>
        </button>
      ))}
    </div>
  );
}
