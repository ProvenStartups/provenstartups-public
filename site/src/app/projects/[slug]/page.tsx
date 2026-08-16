import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, projects, transcripts } from "@/db";
import { eq, and, asc } from "drizzle-orm";
import { getViewer } from "@/lib/viewer";
import { SITE } from "@/lib/site";
import { Dots, Stars, ScoreBars } from "@/components/Score";
import { evidenceOf, tierShort, amountOf } from "@/components/ProjectRow";
import { countryCode } from "@/lib/country";
import { SignupCta, ProCta } from "@/components/LockCta";
import CopyButton from "@/components/CopyButton";

export const revalidate = 0;

async function getProject(slug: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.published, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProject(slug);
  if (!p) return {};
  return {
    title: `${p.name} — ${p.revenue ?? "Proven AI Startup Idea"}`,
    description: p.tagline,
    alternates: { canonical: `/projects/${p.slug}` },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [p, viewer] = await Promise.all([getProject(slug), getViewer()]);
  if (!p) notFound();

  const isGuest = viewer.level === "guest";
  const isMember = viewer.level === "member";

  // 会员专供项目:非会员只见头部 + 升级卡
  const memberWall = p.memberOnly && !isMember;

  const deepDive = p.deepDive ?? [];
  const visibleSections = memberWall
    ? []
    : isGuest
      ? deepDive.slice(0, SITE.guestDeepDiveSections)
      : deepDive;
  const hiddenSections = deepDive.slice(visibleSections.length);

  const trs =
    isMember && !memberWall
      ? await db
          .select()
          .from(transcripts)
          .where(eq(transcripts.projectSlug, p.slug))
          .orderBy(asc(transcripts.sourceIndex))
      : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${p.name} — proven AI startup idea breakdown`,
    description: p.tagline,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: `${SITE.url}/projects/${p.slug}`,
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link href="/projects" className="btn btn-quiet -ml-3">
        ← All ideas
      </Link>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip mono">{tierShort(p.tier)}</span>
          <span className="chip">{p.category}</span>
          {p.region && (
            <span className="chip">
              {countryCode(p.region) && (
                <span className="mono text-[0.62rem] tracking-[0.05em] text-t4">
                  {countryCode(p.region)}
                </span>
              )}
              {p.region}
            </span>
          )}
          <span className="chip hidden sm:inline-flex">{p.timing}</span>
          <span className="chip">
            <span className={`ev ${evidenceOf(p.evidence).cls}`} />
            {evidenceOf(p.evidence).label}
          </span>
          {p.memberOnly && <span className="chip chip-solid">PRO</span>}
        </div>

        <h1 className="h-display mt-4">{p.name}</h1>
        <p className="prose-body mt-3 max-w-2xl">{p.tagline}</p>
      </header>

      {/* 关键数字做成数据条 */}
      <div className="panel panel-lit mt-6 grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
        <div className="border-b border-line px-4 py-3.5 sm:border-b-0">
          <div className="label">Revenue</div>
          <div className="mono money mt-1.5 text-[1.15rem] font-semibold">{amountOf(p.revenue) ?? "—"}</div>
        </div>
        <div className="border-b border-line border-l border-l-line px-4 py-3.5 sm:border-b-0 sm:border-l-0">
          <div className="label">Team</div>
          <div className="mt-1.5 truncate text-[0.86rem]">{p.team ?? "—"}</div>
        </div>
        <div className="px-4 py-3.5">
          <div className="label">Difficulty</div>
          <div className="mt-2">
            <Dots n={p.difficultyDots} />
          </div>
        </div>
        <div className="border-l border-line px-4 py-3.5 sm:border-l-0">
          <div className="label">Upside</div>
          <div className="mt-2">
            <Stars n={p.potentialStars} />
          </div>
        </div>
      </div>

      {p.revenue && p.revenue.split("·").length > 1 && (
        <p className="mt-3 px-1 text-[0.78rem] leading-relaxed text-t3">
          {p.revenue.split("·").slice(1).join(" · ").trim()}
        </p>
      )}

      {p.oneLiner && (
        <div className="mt-6 border-l-2 border-line-2 pl-4 text-[0.89rem] leading-relaxed text-t2">
          {p.oneLiner}
        </div>
      )}

      {memberWall ? (
        <div className="mt-6">
          <ProCta note="This idea is exclusive to Pro members — full breakdown, revenue receipts, playbook, and build prompts." />
        </div>
      ) : (
        <>
          {/* 五维评分 */}
          <section className="panel panel-lit mt-5 p-7">
            <span className="eyebrow">Difficulty profile</span>
            <div className="mt-6">
              <ScoreBars scores={p.scores ?? undefined} />
            </div>
            <p className="mt-6 text-[0.7rem] leading-relaxed text-t4">
              Fewer bars = easier, cheaper, or faster for an AI-assisted solo builder. Editorial
              judgments based on the case details.
            </p>
          </section>

          {/* 深度拆解 */}
          <section className="mt-6">
            <h2 className="px-1 text-[1.25rem] font-semibold tracking-[-0.03em]">Deep dive</h2>
            <div className="mt-4 space-y-4">
              {visibleSections.map((s) => (
                <div key={s.num} className="panel panel-lit p-6">
                  <h3 className="font-bold">
                    <span className="mr-2 text-t1">{s.num}</span>
                    {s.title}
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap text-[0.89rem] leading-[1.78] text-t2">
                    {s.content}
                  </p>
                </div>
              ))}

              {hiddenSections.length > 0 && (
                <>
                  <div className="space-y-2">
                    {hiddenSections.map((s) => (
                      <div key={s.num} className="panel panel-lit flex items-center gap-3 p-4 text-sm text-t4">
                        
                        <span className="font-semibold text-t3">{s.num}</span>
                        <span className="font-medium">{s.title}</span>
                      </div>
                    ))}
                  </div>
                  <SignupCta
                    note={`${hiddenSections.length} more sections — the full story, the playbook, the risks, and the numbers. Free account unlocks everything.`}
                  />
                </>
              )}
            </div>
          </section>

          {/* 速览卡 */}
          {p.quickCard && !isGuest && (
            <section className="panel panel-lit mt-6 space-y-5 p-6">
              <h2 className="text-[1.05rem] font-semibold tracking-[-0.025em]">Quick reference</h2>
              {p.quickCard.acquisition?.length ? (
                <div>
                  <h3 className="label">How they got customers</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-t2">
                    {p.quickCard.acquisition.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {p.quickCard.playbook?.length ? (
                <div>
                  <h3 className="label">Replication playbook</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-t2">
                    {p.quickCard.playbook.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {p.quickCard.risks?.length ? (
                <div>
                  <h3 className="label">Risks & traps</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-t2">
                    {p.quickCard.risks.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {p.quickCard.verdict && (
                <div className="panel panel-lit !rounded-xl bg-s3/60 p-4">
                  <h3 className="label">Our verdict</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-t2">{p.quickCard.verdict}</p>
                </div>
              )}
              {p.quickCard.channels?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {p.quickCard.channels.map((c, i) => (
                    <span key={i} className="chip">
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          )}
          {isGuest && (
            <section className="mt-6">
              <SignupCta note="The quick-reference card — acquisition channels, replication playbook, and risk map — unlocks with a free account." />
            </section>
          )}

          {/* Build prompts:会员专属 */}
          <section className="mt-6">
            <h2 className="px-1 text-[1.25rem] font-semibold tracking-[-0.03em]">Build prompts</h2>
            <p className="mt-1 px-2 text-sm text-t3">
              Paste into Claude Code / Codex and get a working version of this product end-to-end.
            </p>
            {isMember && p.buildPrompt ? (
              <div className="mt-4 space-y-4">
                <div className="panel panel-lit p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="h-sec">End-to-end build prompt</h3>
                    <CopyButton text={p.buildPrompt} />
                  </div>
                  <pre className="mt-4 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-bg p-4 text-[0.8rem] leading-relaxed text-t2">
                    {p.buildPrompt}
                  </pre>
                </div>
                {p.seoPrompt && (
                  <div className="panel panel-lit p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="h-sec">SEO growth prompt</h3>
                      <CopyButton text={p.seoPrompt} />
                    </div>
                    <pre className="mt-4 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-bg p-4 text-[0.8rem] leading-relaxed text-t2">
                      {p.seoPrompt}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <ProCta note="Two production-grade prompts per idea: a full build spec and an SEO growth plan. Copy, paste, ship." />
              </div>
            )}
          </section>

          {/* 溯源 */}
          <section className="mt-6">
            <h2 className="px-1 text-[1.25rem] font-semibold tracking-[-0.03em]">Source receipts</h2>
            <p className="mt-1 px-2 text-sm text-t3">
              Every claim traces back to a source video{isMember ? " — full transcripts below" : ""}.
            </p>
            <div className="mt-4 space-y-4">
              {(p.sources ?? []).map((s, i) => (
                <div key={i} className="panel panel-lit p-5">
                  <div className="text-[0.7rem] text-t4">
                    {s.platform} {s.views ? `· ~${s.views} views` : ""}{" "}
                    {s.fetched ? `· captured ${s.fetched}` : ""}
                  </div>
                  <div className={`mt-1 font-semibold ${isGuest ? "locked" : ""}`}>
                    {s.video_title}
                  </div>
                  {s.video_subtitle && (
                    <div className={`mt-0.5 text-xs text-t3 ${isGuest ? "locked" : ""}`}>
                      {s.video_subtitle}
                    </div>
                  )}
                  {!isGuest && s.video_url && (
                    <a
                      href={s.video_url}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="btn mt-3 !px-4 !py-1.5 !text-[0.8rem]"
                    >
                      Watch source video
                    </a>
                  )}
                  {isMember && trs[i] && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-t3 hover:text-t1">
                        Full transcript ({trs[i].content.length.toLocaleString()} chars, original
                        language)
                      </summary>
                      <div className="mt-2 max-h-[24rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-bg p-4 text-[0.78rem] leading-relaxed text-t2">
                        {trs[i].content}
                      </div>
                    </details>
                  )}
                </div>
              ))}
              {(p.sources ?? []).length === 0 && p.credibility && (
                <div className="panel panel-lit p-5 text-sm text-t3">{p.credibility}</div>
              )}
              {isGuest && (
                <SignupCta note="Source video links unlock with a free account. Full transcripts are Pro." />
              )}
              {!isGuest && !isMember && (p.sources ?? []).length > 0 && (
                <ProCta note="Pro members get the full captured transcripts — the raw material behind every breakdown." />
              )}
            </div>
            {p.credibility && (p.sources ?? []).length > 0 && (
              <p className="mt-4 px-2 text-[0.7rem] leading-relaxed text-t4">
                Data credibility: {p.credibility}
              </p>
            )}
          </section>
        </>
      )}

      <div className="mt-10 flex items-center justify-between">
        <Link href="/projects" className="text-sm text-t1 hover:underline">
          ← All ideas
        </Link>
        <Link href="/" className="text-sm text-t4 hover:text-t2">
          Home
        </Link>
      </div>
    </div>
  );
}
