import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export function SlideLayout({ children, dark = false, number, section }: { children: ReactNode; dark?: boolean; number?: number; section?: string }) {
  return <article className={`slide-content ${dark ? "slide-dark" : "slide-light"}`}>
    <div className="slide-topline"><span className="slide-brand">SMEAR<span>SCAN</span></span><span>{section ?? "MALARIA OUTCOME PREDICTION"}</span></div>
    {children}
    <div className="slide-bottomline"><span>RESEARCH PROTOTYPE · NOT FOR CLINICAL DIAGNOSIS</span><span>{number ? String(number).padStart(2, "0") : ""}</span></div>
  </article>;
}

export function ScaledSlide({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setScale(Math.min(element.clientWidth / 1920, element.clientHeight / 1080)));
    observer.observe(element);
    setScale(Math.min(element.clientWidth / 1920, element.clientHeight / 1080));
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`slide-viewport ${className}`}><div className="slide-wrapper" style={{ transform: `scale(${scale})` }}>{children}</div></div>;
}
