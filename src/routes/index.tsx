import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import p1 from "@/assets/samples/p1.jpg";
import p2 from "@/assets/samples/p2.jpg";
import p3 from "@/assets/samples/p3.jpg";
import u1 from "@/assets/samples/u1.jpg";
import u2 from "@/assets/samples/u2.jpg";
import u3 from "@/assets/samples/u3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmearScan — Malaria Parasite Detection" },
      { name: "description", content: "Upload blood smear images and get AI malaria parasite predictions from an EfficientNetV2S classifier." },
      { property: "og:title", content: "SmearScan — Malaria Parasite Detection" },
      { property: "og:description", content: "Batch-analyze blood smear images for malaria parasites with a deep learning model." },
    ],
  }),
  component: Index,
});

const MAX = 10;
const THRESHOLD = 0.7;
const SAMPLES = [
  { src: p1, name: "parasitized_01.jpg", truth: "parasitized" },
  { src: p2, name: "parasitized_02.jpg", truth: "parasitized" },
  { src: p3, name: "parasitized_03.jpg", truth: "parasitized" },
  { src: u1, name: "uninfected_01.jpg", truth: "uninfected" },
  { src: u2, name: "uninfected_02.jpg", truth: "uninfected" },
  { src: u3, name: "uninfected_03.jpg", truth: "uninfected" },
] as const;

type Item = { id: string; file: File; url: string; truth?: string | undefined; score?: number | undefined; label?: "Positive" | "Negative" | undefined };

function demoScore(item: Item) {
  let h = 0;
  for (const c of item.file.name + item.file.size) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = (h % 1000) / 1000;
  if (item.truth === "parasitized") return 0.82 + r * 0.17;
  if (item.truth === "uninfected") return 0.01 + r * 0.2;
  return r;
}

function Index() {
  const [patient, setPatient] = useState({ id: "", age: "", sex: "" });
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [mode, setMode] = useState<"" | "live" | "demo">("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiUrl(localStorage.getItem("malaria_api_url") ?? import.meta.env.VITE_MALARIA_API_URL ?? "");
  }, []);

  const addFiles = useCallback((files: File[], truth?: string) => {
    setError("");
    const valid = files.filter((f) => /image\/(jpeg|png)/.test(f.type));
    if (valid.length < files.length) setError("Only JPG and PNG images are accepted.");
    setItems((prev) => {
      const room = MAX - prev.length;
      if (valid.length > room) setError(`Maximum ${MAX} images per batch.`);
      return [
        ...prev.map((p) => ({ ...p, score: undefined, label: undefined })),
        ...valid.slice(0, Math.max(0, room)).map((file) => ({
          id: crypto.randomUUID(), file, url: URL.createObjectURL(file), truth,
        })),
      ];
    });
    setMode("");
  }, []);

  const addSample = async (s: (typeof SAMPLES)[number]) => {
    const blob = await (await fetch(s.src)).blob();
    addFiles([new File([blob], s.name, { type: "image/jpeg" })], s.truth);
  };

  const remove = (id: string) => setItems((p) => p.filter((i) => i.id !== id));

  const analyze = async () => {
    setError("");
    if (!items.length) return setError("Add at least one image.");
    if (!patient.id) return setError("Enter a Patient ID.");
    setBusy(true);
    try {
      if (apiUrl) {
        const fd = new FormData();
        items.forEach((i) => fd.append("files", i.file, i.file.name));
        fd.append("patient_id", patient.id);
        fd.append("age", patient.age);
        fd.append("sex", patient.sex);
        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/predict`, { method: "POST", body: fd });
        if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
        const data = await res.json();
        setItems((prev) => prev.map((it, idx) => ({ ...it, score: data.results[idx].score, label: data.results[idx].label })));
        setMode("live");
      } else {
        await new Promise((r) => setTimeout(r, 900));
        setItems((prev) => prev.map((it) => {
          const score = demoScore(it);
          return { ...it, score, label: score >= THRESHOLD ? "Positive" : "Negative" };
        }));
        setMode("demo");
      }
    } catch (e) {
      setError(e instanceof Error ? `Could not reach the model server. ${e.message}` : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  const analyzed = items.filter((i) => i.label);
  const positives = analyzed.filter((i) => i.label === "Positive").length;

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-stain/15 ring-2 ring-stain/40">
              <div className="h-3 w-3 rounded-full bg-stain" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">SmearScan</h1>
              <p className="font-mono text-xs text-muted-foreground">Malaria outcome classifier · EfficientNetV2S</p>
            </div>
          </div>
          <ApiSettings apiUrl={apiUrl} setApiUrl={setApiUrl} />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <section className="rounded-lg border bg-card p-5">
            <SectionTitle n="01" title="Patient information" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Patient ID">
                <input className="field" value={patient.id} placeholder="PT-00123" onChange={(e) => setPatient({ ...patient, id: e.target.value })} />
              </Field>
              <Field label="Age">
                <input className="field" type="number" min={0} max={120} value={patient.age} placeholder="34" onChange={(e) => setPatient({ ...patient, age: e.target.value })} />
              </Field>
              <Field label="Sex">
                <select className="field" value={patient.sex} onChange={(e) => setPatient({ ...patient, sex: e.target.value })}>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5">
            <SectionTitle n="02" title="Blood smear images" aside={`${items.length}/${MAX}`} />
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(Array.from(e.dataTransfer.files)); }}
              onClick={() => inputRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted"}`}
            >
              <p className="font-medium">Drag & drop smear images here</p>
              <p className="mt-1 text-sm text-muted-foreground">or click to browse · JPG, PNG · up to {MAX} images</p>
              <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple hidden
                onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            </div>

            {items.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {items.map((it) => (
                  <div key={it.id} className="group relative overflow-hidden rounded-md border bg-foreground">
                    <img src={it.url} alt={it.file.name} className="aspect-square w-full object-cover" />
                    <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase ${
                      !it.label ? "bg-card/90 text-muted-foreground" : it.label === "Positive" ? "bg-positive text-positive-foreground" : "bg-negative text-negative-foreground"}`}>
                      {!it.label ? "Pending" : it.label === "Positive" ? "Infected" : "Uninfected"}
                    </span>
                    <button onClick={() => remove(it.id)} aria-label="Remove image"
                      className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-card/90 text-xs opacity-0 transition group-hover:opacity-100">✕</button>
                    <p className="truncate bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground">{it.file.name}</p>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button onClick={analyze} disabled={busy || !items.length}
                className="rounded-md bg-primary px-6 py-2.5 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
                {busy ? "Analyzing…" : "Analyze smear"}
              </button>
              {items.length > 0 && (
                <button onClick={() => { setItems([]); setMode(""); }} className="text-sm text-muted-foreground hover:text-foreground">Clear all</button>
              )}
              {!apiUrl && <span className="font-mono text-xs text-muted-foreground">No model server connected — runs in demo mode</span>}
            </div>
          </section>

          {analyzed.length > 0 && (
            <section className="rounded-lg border bg-card p-5">
              <SectionTitle n="03" title="Prediction results" aside={mode === "demo" ? "DEMO · simulated" : "Live model"} />
              <div className="mb-4 flex flex-wrap gap-x-8 gap-y-1 rounded-md bg-muted px-4 py-3 font-mono text-sm">
                <span>Patient: <b>{patient.id}</b></span>
                {patient.age && <span>Age: {patient.age}</span>}
                {patient.sex && <span>Sex: {patient.sex}</span>}
                <span className={positives ? "text-positive" : "text-negative"}>
                  {positives} of {analyzed.length} images parasitized
                </span>
              </div>
              <ul className="divide-y">
                {analyzed.map((it) => (
                  <li key={it.id} className="flex items-center gap-4 py-3">
                    <img src={it.url} alt="" className="h-12 w-12 rounded object-cover" />
                    <span className="flex-1 truncate font-mono text-sm">{it.file.name}</span>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${it.label === "Positive" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"}`}>
                      {it.label}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">Positive = model score ≥ {THRESHOLD}. Research tool — not a substitute for clinical microscopy.</p>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-lg border bg-card p-5 lg:sticky lg:top-6">
          <h2 className="font-semibold">Try sample images</h2>
          <p className="mt-1 text-sm text-muted-foreground">Click to add to the batch — no upload needed.</p>
          {(["parasitized", "uninfected"] as const).map((group) => (
            <div key={group} className="mt-4">
              <p className={`mb-2 font-mono text-xs uppercase ${group === "parasitized" ? "text-positive" : "text-negative"}`}>{group}</p>
              <div className="grid grid-cols-3 gap-2">
                {SAMPLES.filter((s) => s.truth === group).map((s) => (
                  <button key={s.name} onClick={() => addSample(s)} disabled={items.length >= MAX}
                    className="overflow-hidden rounded-md border-2 border-transparent transition hover:border-primary disabled:opacity-40">
                    <img src={s.src} alt={s.name} loading="lazy" width={816} height={816} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => SAMPLES.forEach(addSample)}
            className="mt-4 w-full rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">Add all 6 samples</button>
        </aside>
      </main>
    </div>
  );
}

function SectionTitle({ n, title, aside }: { n: string; title: string; aside?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="flex items-baseline gap-2 font-semibold">
        <span className="font-mono text-xs text-stain">{n}</span>{title}
      </h2>
      {aside && <span className="font-mono text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ApiSettings({ apiUrl, setApiUrl }: { apiUrl: string; setApiUrl: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(apiUrl);
  const [status, setStatus] = useState("");
  useEffect(() => setVal(apiUrl), [apiUrl]);
  const save = async () => {
    const v = val.trim();
    localStorage.setItem("malaria_api_url", v);
    setApiUrl(v);
    if (!v) return setStatus("Demo mode");
    try {
      const r = await fetch(`${v.replace(/\/$/, "")}/health`);
      setStatus(r.ok ? "Connected ✓" : `Error ${r.status}`);
    } catch { setStatus("Unreachable"); }
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
        <span className={`h-2 w-2 rounded-full ${apiUrl ? "bg-negative" : "bg-muted-foreground"}`} />
        Model server
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border bg-popover p-4 shadow-lg">
          <p className="mb-2 text-sm font-medium">Python API URL</p>
          <input className="field" placeholder="http://localhost:8000" value={val} onChange={(e) => setVal(e.target.value)} />
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">{status}</span>
            <button onClick={save} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Save & test</button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Leave empty for demo mode.</p>
        </div>
      )}
    </div>
  );
}
