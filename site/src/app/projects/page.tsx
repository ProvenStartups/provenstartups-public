import type { Metadata } from "next";
import Link from "next/link";
import { db, projects } from "@/db";
import { asc, eq } from "drizzle-orm";
import ProjectRow, { type RowProject } from "@/components/ProjectRow";
import { getViewer } from "@/lib/viewer";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "All ideas",
  description:
    "Every AI startup idea in the index — revenue figures, evidence class, difficulty scores, and the source video behind each one.",
  alternates: { canonical: "/projects" },
};

export const revalidate = 300;

const TIERS = [
  { key: "1", label: "T1" },
  { key: "2", label: "T2" },
  { key: "3", label: "T3" },
];
const EVIDENCE = [
  { key: "verified", match: "✅", label: "Verified", cls: "ev-hard" },
  { key: "founder", match: "🗣", label: "Founder", cls: "ev-founder" },
  { key: "creator", match: "📎", label: "Creator", cls: "ev-creator" },
  { key: "potential", match: "🔮", label: "Unproven", cls: "ev-unproven" },
];
const TIMING = [
  { key: "evergreen", match: "🌲", label: "Evergreen" },
  { key: "window", match: "⏳", label: "Window" },
];

type SP = { tier?: string; evidence?: string; timing?: string; category?: string };

function filterHref(sp: SP, k: keyof SP, v: string) {
  const next: SP = { ...sp };
  if (next[k] === v) delete next[k];
  else next[k] = v;
  const qs = new URLSearchParams(
    Object.entries(next).filter(([, val]) => val) as [string, string][]
  ).toString();
  return qs ? `/projects?${qs}` : "/projects";
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const viewer = await getViewer();

  const all = await db
    .select({
      slug: projects.slug,
      rank: projects.rank,
      tier: projects.tier,
      category: projects.category,
      timing: projects.timing,
      evidence: projects.evidence,
      name: projects.name,
      tagline: projects.tagline,
      revenue: projects.revenue,
      team: projects.team,
      region: projects.region,
      difficultyDots: projects.difficultyDots,
      oneLiner: projects.oneLiner,
      potentialStars: projects.potentialStars,
      memberOnly: projects.memberOnly,
    })
    .from(projects)
    .where(eq(projects.published, true))
    .orderBy(asc(projects.rank));

  const categories = Array.from(new Set(all.map((p) => p.category))).sort();

  let list = all;
  if (sp.tier) list = list.filter((p) => p.tier.startsWith(`Tier ${sp.tier}`));
  const ev = EVIDENCE.find((e) => e.key === sp.evidence);
  if (ev) list = list.filter((p) => p.evidence.startsWith(ev.match));
  const tm = TIMING.find((t) => t.key === sp.timing);
  if (tm) list = list.filter((p) => p.timing.startsWith(tm.match));
  if (sp.category) list = list.filter((p) => p.category === sp.category);

  const isGuest = viewer.level === "guest";
  const isMember = viewer.level === "member";
  const hasFilter = !!(sp.tier || sp.evidence || sp.timing || sp.category);

  const lockedForViewer = (p: RowProject) => {
    if (p.memberOnly && !isMember) return true;
    if (isGuest && p.rank > SITE.guestVisibleCount) return true;
    return false;
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* ═══════ 页头 ═══════ */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-9 pb-5 sm:pt-12">
        <div>
          <span className="label">Index</span>
          <h1 className="h-display mt-2 text-[1.5rem] sm:text-[2rem]">
            {hasFilter ? (
              <>
                <span className="mono">{list.length}</span> of {all.length} ideas
              </>
            ) : (
              <>
                <span className="mono">{all.length}</span> ideas
              </>
            )}
          </h1>
        </div>
        {isGuest && (
          <Link href="/sign-in" className="btn btn-primary">
            Unlock all {all.length}
          </Link>
        )}
      </div>

      {/* ═══════ 筛选条 ═══════ */}
      <div className="panel panel-lit mb-3 flex items-center gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="label shrink-0 pr-1">Tier</span>
        {TIERS.map((t) => (
          <Link
            key={t.key}
            href={filterHref(sp, "tier", t.key)}
            className={`chip mono shrink-0 ${sp.tier === t.key ? "chip-on" : ""}`}
          >
            {t.label}
          </Link>
        ))}

        <span className="mx-1 h-4 w-px shrink-0 bg-line" />
        <span className="label shrink-0 pr-1">Evidence</span>
        {EVIDENCE.map((e) => (
          <Link
            key={e.key}
            href={filterHref(sp, "evidence", e.key)}
            className={`chip shrink-0 ${sp.evidence === e.key ? "chip-on" : ""}`}
          >
            <span className={`ev ${e.cls}`} />
            {e.label}
          </Link>
        ))}

        <span className="mx-1 hidden h-4 w-px shrink-0 bg-line sm:block" />
        {TIMING.map((t) => (
          <Link
            key={t.key}
            href={filterHref(sp, "timing", t.key)}
            className={`chip hidden shrink-0 sm:inline-flex ${
              sp.timing === t.key ? "chip-on" : ""
            }`}
          >
            {t.label}
          </Link>
        ))}

        <details className="relative shrink-0 sm:ml-auto">
          <summary className={`chip cursor-pointer list-none ${sp.category ? "chip-on" : ""}`}>
            {sp.category ?? "Category"} ↓
          </summary>
          <div className="panel-2 absolute right-0 top-7 z-30 flex max-h-80 w-56 flex-col gap-1 overflow-y-auto p-2">
            {categories.map((c) => (
              <Link
                key={c}
                href={filterHref(sp, "category", c)}
                className={`chip ${sp.category === c ? "chip-on" : ""}`}
              >
                {c}
              </Link>
            ))}
          </div>
        </details>

        {hasFilter && (
          <Link href="/projects" className="chip shrink-0 text-t3">
            Clear
          </Link>
        )}
      </div>

      {/* ═══════ 数据表 ═══════ */}
      <div className="panel panel-lit overflow-hidden">
        <div className="hidden border-b border-line bg-s2 px-5 py-2.5 sm:grid sm:grid-cols-[8.5rem_1fr_auto] sm:gap-x-5">
          <span className="label">Revenue</span>
          <span className="label">Idea</span>
          <span className="label text-right">Category · Evidence · Difficulty</span>
        </div>

        {list.map((p, i) => (
          <ProjectRow key={p.slug} p={p} locked={lockedForViewer(p)} index={i + 1} />
        ))}

        {list.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <p className="text-[0.86rem] text-t3">Nothing matches those filters.</p>
            <Link href="/projects" className="btn">
              Clear filters
            </Link>
          </div>
        )}
      </div>

      {isGuest && list.length > 0 && (
        <div className="panel-2 mt-3 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-[0.83rem] text-t2">
            Showing the first {SITE.guestVisibleCount} in full. A free account opens all{" "}
            {all.length}.
          </p>
          <Link href="/sign-in" className="btn btn-primary">
            Create free account
          </Link>
        </div>
      )}
    </div>
  );
}
