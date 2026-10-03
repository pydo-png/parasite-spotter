import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Grid2X2, Minimize, NotebookPen, Play, Printer, X } from "lucide-react";
import { deck } from "@/components/slides/deck";
import { ScaledSlide } from "@/components/slides/SlideLayout";

export const Route = createFileRoute("/slides")({
  head: () => ({ meta: [
    { title: "SmearScan Presentation — Malaria Outcome Prediction" },
    { name: "description", content: "A presentation of the SmearScan malaria blood smear classification project, model, workflow, and limitations." },
    { property: "og:title", content: "SmearScan Presentation — Malaria Outcome Prediction" },
    { property: "og:description", content: "Explore the SmearScan malaria classifier presentation, from blood smear input to responsible evaluation." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SlidesPage,
});

const notes = [
  "Introduce the project as a computer-assisted first pass, not a diagnostic device.",
  "Explain why timely review of microscopy images matters. Avoid claiming measured time savings.",
  "Walk through upload, model inference, and review. This is a binary prediction, not species detection.",
  "Describe the actual source and split of your training data verbally if you have verified details. The images here are illustrative.",
  "Point out the 150 × 150 RGB input and sigmoid output. The threshold is 0.70.",
  "Explain that threshold choice affects the balance of missed infections and false alarms. Do not claim it is clinically optimized.",
  "Show patient details, ten-image limit, sample gallery, and per-image labels.",
  "For a live demo, the Python API must be running with the trained .h5 file and linked in the web app.",
  "Replace placeholders only with real held-out test results. Mention test-set size and confusion matrix if available.",
  "Open the app in another tab for a demonstration. Confirm it is connected to the model server first; otherwise explain demo mode.",
  "Be candid: no species classification, no parasite density measurement, no clinical validation.",
  "Describe validation, explainability, and expanded labels as future work, not completed features.",
  "Invite questions. If asked whether it replaces microscopy, answer no: it supports review, not diagnosis.",
];

function getSlide(i: number): (typeof deck)[number] {
  const slide = deck[i] ?? deck[0];
  if (!slide) throw new Error("Presentation has no slides");
  return slide;
}

function clampIndex(value: number) { return Math.max(0, Math.min(deck.length - 1, value)); }
function getInitialIndex() {
  if (typeof window === "undefined") return 0;
  const value = Number(new URLSearchParams(window.location.search).get("slide"));
  return Number.isFinite(value) && value >= 1 ? clampIndex(Math.floor(value) - 1) : 0;
}

function SlidesPage() {
  const [index, setIndex] = useState(0);
  const [isPrint, setIsPrint] = useState(false);
  const [grid, setGrid] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>(() => deck.map((_, i) => i));
  const [hidden, setHidden] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [cursorHidden, setCursorHidden] = useState(false);
  const touch = useRef<number | null>(null);
  const dragIndex = useRef<number | null>(null);
  const currentPosition = order.filter(i => !hidden.includes(i)).indexOf(index);
  const visible = order.filter(i => !hidden.includes(i));
  const current = getSlide(index);
  const move = useCallback((direction: number) => {
    const currentAt = visible.indexOf(index);
    const next = visible[clampIndex(currentAt + direction)];
    if (next !== undefined) setIndex(next);
  }, [index, visible]);
  const go = (i: number) => { setIndex(i); setGrid(false); };

  useEffect(() => {
    setIsPrint(new URLSearchParams(window.location.search).has("print"));
    setStartTime(Date.now());
    const initial = getInitialIndex();
    setIndex(initial);
    const onPop = () => setIndex(getInitialIndex());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("slide", String(index + 1));
    window.history.replaceState(null, "", url);
    document.title = `${currentPosition + 1}/${visible.length} — ${current.title} | SmearScan`;
  }, [index, current.title, currentPosition, visible.length]);
  useEffect(() => {
    const onFull = () => setPresenting(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
      if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") { event.preventDefault(); move(1); }
      if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); move(-1); }
      if (event.key.toLowerCase() === "g" && !presenting) setGrid(v => !v);
      if (event.key === "F5") { event.preventDefault(); document.documentElement.requestFullscreen().catch(() => {}); }
      if (event.key === "Escape") setGrid(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, presenting]);
  useEffect(() => {
    if (!presenting || !startTime) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [presenting, startTime]);
  useEffect(() => {
    if (!presenting) return;
    setCursorHidden(false);
    const id = window.setTimeout(() => setCursorHidden(true), 2200);
    return () => window.clearTimeout(id);
  }, [presenting, index]);
  useEffect(() => {
    if (!presenting || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("smearscan-presenter");
    channel.postMessage({ index, next: visible[currentPosition + 1] ?? null, elapsed });
    return () => channel.close();
  }, [index, presenting, currentPosition, visible, elapsed]);

  const onTouchStart = (event: React.TouchEvent) => { touch.current = event.changedTouches[0]?.screenX ?? null; };
  const onTouchEnd = (event: React.TouchEvent) => {
    const end = event.changedTouches[0]?.screenX;
    if (touch.current !== null && end !== undefined && Math.abs(end - touch.current) > 55) move(end < touch.current ? 1 : -1);
    touch.current = null;
  };
  const toggleSelection = (i: number, multi: boolean) => setSelected(prev => multi ? prev.includes(i) ? prev.filter(n => n !== i) : [...prev, i] : [i]);
  const duplicateSelected = () => {
    if (!selected.length) return;
    setOrder(prev => { const copy = [...prev]; selected.forEach(i => { const at = copy.indexOf(i); if (at >= 0) copy.splice(at + 1, 0, i); }); return copy; });
    setSelected([]);
  };
  const deleteSelected = () => {
    const nextHidden = [...new Set([...hidden, ...selected])];
    if (nextHidden.length >= deck.length) return;
    setHidden(nextHidden);
    if (selected.includes(index)) setIndex(order.find(i => !nextHidden.includes(i)) ?? 0);
    setSelected([]);
  };
  if (isPrint) return <div className="print-deck">{visible.map((i, position) => <div className="print-slide" key={`${i}-${position}`}>{getSlide(i).element}</div>)}</div>;

  return <div className={`deck-app ${presenting ? "deck-presenting" : ""} ${cursorHidden ? "deck-cursor-hidden" : ""}`}>
    {!presenting && <header className="deck-toolbar"><div className="deck-toolbar-left"><Link to="/" className="deck-tool" title="Back to SmearScan"><ArrowLeft size={20}/></Link><span className="deck-title">SmearScan <span>/ Presentation</span></span></div><div className="deck-toolbar-right"><button className={`deck-tool ${grid ? "active" : ""}`} title="Slide overview" onClick={() => setGrid(v => !v)}><Grid2X2 size={20}/></button><button className={`deck-tool ${notesOpen ? "active" : ""}`} title="Speaker notes" onClick={() => setNotesOpen(v => !v)}><NotebookPen size={20}/></button><button className="deck-tool" title="Print or save as PDF" onClick={() => window.open("/slides?print", "_blank")}><Printer size={20}/></button><button className="deck-present-button" onClick={() => document.documentElement.requestFullscreen().catch(() => {})}><Play size={16} fill="currentColor"/> Present</button></div></header>}
    {grid && !presenting ? <main className="deck-grid-page"><div className="deck-grid-head"><div><span className="deck-overline">PRESENTATION</span><h1>Slide overview</h1></div><div className="deck-grid-actions">{selected.length > 0 && <><button onClick={duplicateSelected} title="Duplicate selected slides">Duplicate</button><button onClick={deleteSelected} title="Hide selected slides">Hide</button></>}<button onClick={() => setGrid(false)} title="Close overview"><X size={20}/></button></div></div><div className="deck-grid">{visible.map((i, position) => <div key={`${i}-${position}`} draggable onDragStart={() => { dragIndex.current = position; }} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragIndex.current === null) return; const copy = [...order]; const from = copy.indexOf(visible[dragIndex.current] ?? -1); const to = copy.indexOf(i); if (from < 0 || to < 0) return; const [item] = copy.splice(from, 1); if (item !== undefined) copy.splice(to, 0, item); setOrder(copy); dragIndex.current = null; }} className={`deck-grid-item ${selected.includes(i) ? "selected" : ""}`}><div className="deck-grid-preview" onClick={() => go(i)}><ScaledSlide>{getSlide(i).element}</ScaledSlide></div><div className="deck-grid-item-footer"><label><input type="checkbox" checked={selected.includes(i)} onChange={e => toggleSelection(i, e.nativeEvent instanceof MouseEvent ? e.nativeEvent.shiftKey : true)} aria-label={`Select ${getSlide(i).title}`}/><span>{String(position + 1).padStart(2, "0")} · {getSlide(i).title}</span></label></div></div>)}</div></main> : <div className="deck-workspace"><aside className="deck-sidebar" aria-label="Slide thumbnails">{visible.map((i, position) => <button key={`${i}-${position}`} className={`deck-thumb ${index === i ? "active" : ""}`} onClick={() => go(i)} title={`Slide ${position + 1}: ${getSlide(i).title}`}><ScaledSlide>{getSlide(i).element}</ScaledSlide><span>{String(position + 1).padStart(2, "0")} &nbsp; {getSlide(i).title}</span></button>)}</aside><main className="deck-main"><div className="deck-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onMouseMove={() => { if (presenting) { setCursorHidden(false); window.setTimeout(() => setCursorHidden(true), 2200); } }}><ScaledSlide>{current.element}</ScaledSlide>{!presenting && <div className="deck-navigation"><button title="Previous slide" disabled={currentPosition <= 0} onClick={() => move(-1)}><ChevronLeft size={22}/></button><span>{currentPosition + 1} / {visible.length}</span><button title="Next slide" disabled={currentPosition >= visible.length - 1} onClick={() => move(1)}><ChevronRight size={22}/></button></div>}{presenting && <div className="deck-present-controls"><button title="Previous slide" onClick={() => move(-1)}><ChevronLeft/></button><span>{currentPosition + 1} / {visible.length}</span><button title="Next slide" onClick={() => move(1)}><ChevronRight/></button><button title="Exit fullscreen" onClick={() => document.exitFullscreen().catch(() => {})}><Minimize/></button></div>}</div>{!presenting && notesOpen && <section className="deck-notes"><div className="deck-notes-heading"><strong>Speaker notes</strong><span>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span></div><textarea aria-label="Speaker notes" key={index} defaultValue={notes[index] ?? ""} /></section>}</main></div>}
  </div>;
}
