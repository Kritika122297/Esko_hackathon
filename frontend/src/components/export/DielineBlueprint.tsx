"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ClipboardCopy, Loader2, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/shared/badges";
import { api } from "@/lib/api";
import { Blueprint, BlueprintPanel } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_TEXT: Record<BlueprintPanel["role"], string> = {
  pdp: "Principal display panel",
  info: "Information panel",
  back: "Back panel",
  side: "Side panel",
  flap: "Flap",
  barcode: "Barcode panel",
  other: "Panel",
};

function Unverified() {
  return (
    <span className="meta text-talker-deep" title="From the draft layout rules; not yet checked against the official text">
      Not verified
    </span>
  );
}

/** One copy block with a button that puts it on the clipboard, ready to paste into Illustrator. */
function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt(`Copy ${label}`, text); // clipboard blocked: let the person copy it by hand
    }
  };
  return (
    <div className="rounded border border-line bg-stock p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        <Button variant="outline" size="sm" onClick={copy} aria-label={`Copy ${label} for Illustrator`}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy for Illustrator"}
        </Button>
      </div>
      <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-ink-2">{text}</p>
    </div>
  );
}

/** Flat-plan wireframe of the pack with the layout rules drawn on it, and the type-size spec card. */
export function DielineBlueprint({ sessionId, version }: { sessionId: string; version: string }) {
  const [bp, setBp] = useState<Blueprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    api
      .blueprint(sessionId)
      .then((b) => {
        if (!current) return;
        setBp(b);
        setSelected((s) => s ?? b.pdp_panel ?? b.panels[0]?.id ?? null);
      })
      .catch((e) => current && setError(e instanceof Error ? e.message : "The blueprint could not be loaded."));
    return () => {
      current = false;
    };
  }, [sessionId, version]);

  if (error) return <p role="alert" className="text-sm text-stop-deep">{error}</p>;
  if (!bp) return <p className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Drawing the blueprint…</p>;

  const fs = Math.max(bp.page_width, bp.page_height) / 70; // label size in the drawing's own units
  const panel = bp.panels.find((p) => p.id === selected) ?? null;
  const zone = bp.overlays.find((o) => o.kind === "zone");
  const group = bp.overlays.find((o) => o.kind === "group");
  const quiet = bp.overlays.find((o) => o.kind === "quiet_zone");
  const onPanel = bp.overlays.filter((o) => o.panel && o.panel === selected);

  return (
    <div className="space-y-8">
      {bp.notes.length > 0 && (
        <ul className="space-y-1 rounded border border-talker/60 bg-talker-soft px-4 py-3 text-[13px] text-ink">
          {bp.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <figure className="min-w-0">
          <svg
            viewBox={`0 0 ${bp.page_width} ${bp.page_height}`}
            role="group"
            aria-label={bp.generic ? "Generic carton layout" : "Flat plan of the pack from the dieline"}
            className="h-auto w-full rounded border border-line bg-ground"
          >
            <defs>
              <pattern id="bp-zone" width={fs} height={fs} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={fs} height={fs} fill="#FFF4CC" />
                <line x1="0" y1="0" x2="0" y2={fs} stroke="#FFD23F" strokeWidth={fs / 4} />
              </pattern>
            </defs>
            {bp.panels.map((p) => {
              const [x0, y0, x1, y1] = p.bbox;
              const on = p.id === selected;
              return (
                <g key={p.id}>
                  <rect
                    x={x0}
                    y={y0}
                    width={x1 - x0}
                    height={y1 - y0}
                    tabIndex={0}
                    role="button"
                    aria-pressed={on}
                    aria-label={`${p.label}: ${p.items.length} copy blocks`}
                    onClick={() => setSelected(p.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(p.id))}
                    className="cursor-pointer outline-none focus-visible:stroke-[#121514]"
                    fill={on ? "#E3EDE8" : p.role === "flap" ? "#F7F8F4" : "#FFFFFF"}
                    stroke={p.role === "pdp" ? "#0F3D2E" : "#AEB4A9"}
                    strokeWidth={p.role === "pdp" || on ? fs / 4 : fs / 10}
                  />
                  {p.role !== "flap" && (
                    <text x={x0 + fs * 0.6} y={y0 + fs * 1.4} fontSize={fs} fontWeight={700} fill="#121514" pointerEvents="none">
                      {p.role === "pdp" ? "PDP" : p.role === "info" ? "Information panel" : p.label.replace(/ panel.*$/i, "")}
                    </text>
                  )}
                  {p.items.length > 0 && p.role !== "flap" && (
                    <text x={x0 + fs * 0.6} y={y0 + fs * 2.7} fontSize={fs * 0.8} fill="#5A615C" pointerEvents="none">
                      {p.items.length} copy block{p.items.length === 1 ? "" : "s"}
                    </text>
                  )}
                </g>
              );
            })}
            {zone && !zone.exempt && (() => {
              const p = bp.panels.find((x) => x.id === zone.panel);
              if (!p || !zone.fraction) return null;
              const [x0, y0, x1, y1] = p.bbox;
              const h = (y1 - y0) * zone.fraction;
              return (
                <g pointerEvents="none">
                  <rect x={x0} y={y1 - h} width={x1 - x0} height={h} fill="url(#bp-zone)" opacity={0.85} />
                  {/* Short label inside the panel; the citation is in the side card. */}
                  <text x={x0 + fs * 0.6} y={y1 - h + fs * 1.3} fontSize={fs * 0.8} fontWeight={700} fill="#8A6A00">
                    Net quantity zone ({Math.round(zone.fraction * 100)}%)
                  </text>
                </g>
              );
            })()}
            {group && (() => {
              const p = bp.panels.find((x) => x.id === group.panel);
              if (!p) return null;
              const [x0, y0, x1, y1] = p.bbox;
              const pad = fs * 0.4;
              return (
                <rect x={x0 + pad} y={y0 + pad} width={x1 - x0 - 2 * pad} height={y1 - y0 - 2 * pad} fill="none" pointerEvents="none"
                  stroke={group.ok === false ? "#D92B2B" : "#0F3D2E"} strokeWidth={fs / 5} strokeDasharray={`${fs} ${fs / 2}`} />
              );
            })()}
            {quiet && quiet.panel && (() => {
              const p = bp.panels.find((x) => x.id === quiet.panel);
              if (!p) return null;
              const [x0, , x1, y1] = p.bbox;
              const w = (x1 - x0) * 0.5;
              const cx = (x0 + x1) / 2;
              return (
                <g pointerEvents="none">
                  <rect x={cx - w / 2} y={y1 - fs * 5} width={w} height={fs * 3} fill="#FFFFFF" stroke="#121514" strokeDasharray={`${fs / 3}`} strokeWidth={fs / 12} />
                  <text x={cx} y={y1 - fs * 3.2} fontSize={fs * 0.7} textAnchor="middle" fill="#121514">Barcode + quiet zone</text>
                </g>
              );
            })()}
          </svg>
          <figcaption className="mt-2 text-xs text-ink-muted">
            {bp.generic ? "Generic tuck carton (no dieline read). " : "Drawn from the dieline in your files. "}
            Click a panel to see its copy. Hatched: net quantity zone. Dashed: information panel group
            {group?.ok === false ? " (red: the copy is split across panels)" : ""}.
          </figcaption>
        </figure>

        <aside className="space-y-4" aria-live="polite">
          {panel ? (
            <div className="rounded border border-line bg-stock p-4">
              <p className="meta text-ink-muted">{ROLE_TEXT[panel.role]}</p>
              <h3 className="text-[16px] font-bold text-ink">{panel.label}</h3>
              {panel.items.length ? (
                <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
                  {panel.items.map((i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rail" /> {i}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] text-ink-muted">No copy blocks are placed on this panel.</p>
              )}
              {onPanel.map((o) => (
                <div key={o.label} className="mt-3 border-t border-line pt-2 text-[12px]">
                  <p className="font-semibold text-ink">{o.label}</p>
                  <p className="text-ink-2">{o.text}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-ink-faint">
                    {o.citation} {!o.verified && <Unverified />}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {quiet && (
            <div className="rounded border border-line bg-stock p-4 text-[12px]">
              <p className="font-semibold text-ink">Barcode quiet zone</p>
              <p className="text-ink-2">{quiet.text}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-ink-faint">
                {quiet.citation} {!quiet.verified && <Unverified />}
              </p>
            </div>
          )}
        </aside>
      </div>

      <section aria-labelledby="spec-h" className="space-y-3">
        <div className="section-rule">
          <h3 id="spec-h" className="flex items-center gap-2 text-[16px] font-bold text-ink">
            <Ruler className="h-4 w-4" aria-hidden /> Type and size spec
          </h3>
          <span className="text-xs text-ink-muted">US and EU values are separate rules</span>
        </div>
        {bp.dimensions ? (
          <p className="text-[13px] text-ink-2">
            Front panel {bp.dimensions.width_in} × {bp.dimensions.height_in} in = <b>{bp.dimensions.area_sq_in} sq in</b> ({bp.dimensions.area_cm2} cm²),{" "}
            {bp.dimensions.source === "brief" ? "from the brief." : "estimated from the dieline at 100% scale."}
          </p>
        ) : null}
        {bp.dimensions_needed && (
          <p className="flex flex-wrap items-center gap-2 rounded border border-talker/60 bg-talker-soft px-3 py-2 text-[13px] text-ink">
            <Flag tone="review" side="right" className="-ml-3">Dimensions needed</Flag>
            Enter the real front panel size as “Front panel (PDP) size” in the{" "}
            <Link href="/review" className="font-semibold underline">workbench</Link>, for example 190 × 280 mm.
          </p>
        )}
        {bp.general_only && <p className="text-[13px] text-ink-muted">General checks only for this category: no category-specific type sizes apply.</p>}
        {bp.type_specs.length > 0 ? (
          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-ground">
                <tr className="border-b border-line">
                  <th scope="col" className="meta px-3 py-2 text-ink-muted">Element</th>
                  <th scope="col" className="meta px-3 py-2 text-ink-muted">Minimum height</th>
                  <th scope="col" className="meta px-3 py-2 text-ink-muted">Based on</th>
                  <th scope="col" className="meta px-3 py-2 text-ink-muted">Rule</th>
                </tr>
              </thead>
              <tbody>
                {bp.type_specs.map((s) => (
                  <tr key={s.element + s.citation} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="px-3 py-2 font-semibold text-ink">{s.element}</th>
                    <td className={cn("px-3 py-2 tabular-nums", s.min_height ? "font-bold text-ink" : "text-ink-muted")}>
                      {s.min_height ?? "Dimensions needed"}
                    </td>
                    <td className="px-3 py-2 text-ink-2">
                      {s.basis}
                      {s.note && <span className="block text-xs text-ink-muted">{s.note}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block font-mono text-[11px] text-ink-2">{s.citation}</span>
                      {!s.verified && <Unverified />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !bp.general_only && <p className="text-[13px] text-ink-muted">No type-size rules are loaded for this market and category.</p>
        )}
      </section>

      {bp.copy_blocks.length > 0 && (
        <section aria-labelledby="copy-for-h" className="space-y-3">
          <div className="section-rule">
            <h3 id="copy-for-h" className="text-[16px] font-bold text-ink">Copy for Illustrator</h3>
            <span className="text-xs text-ink-muted">Approved text, cleaned for pasting</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {bp.copy_blocks.map((c) => (
              <CopyButton key={c.key} label={c.label} text={c.text} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
