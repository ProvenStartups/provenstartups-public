import { NextResponse } from "next/server";
import { db, errorEvents, projects } from "@/db";
import { sql, eq, and, or, isNull, not, like } from "drizzle-orm";
import { NOISY_ROUTES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  // 1) 数据库连通 + 项目数
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects);
    checks.db = "ok";
    checks.projects = count;
  } catch (e) {
    checks.db = `fail: ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`;
    healthy = false;
  }

  // 2) 必需环境变量(只报名字,不回显值)
  const required = [
    "DATABASE_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID",
  ];
  const missing = required.filter((k) => !process.env[k]);
  checks.env_missing = missing;
  if (missing.length) healthy = false;

  // 3) Stripe key 模式
  const sk = process.env.STRIPE_SECRET_KEY || "";
  checks.stripe_mode = sk.startsWith("sk_live") || sk.startsWith("rk_live") ? "live" : sk ? "test" : "absent";

  // 4) 错误收件箱未解决严重数
  //    坑:webhook 验签失败也会入收件箱,而这个端点是公网可见的 —— 任意扫描器
  //    POST 一次就能把 healthy 打成 false。噪音路由照常留档,但不参与置红。
  try {
    const noiseFilter = NOISY_ROUTES.map((r) =>
      not(like(errorEvents.route, `${r}%`))
    );
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(errorEvents)
      .where(
        and(
          eq(errorEvents.resolved, false),
          or(isNull(errorEvents.route), and(...noiseFilter))
        )
      );
    checks.unresolved_errors = count;
    if (count > 0) healthy = false;
  } catch {
    checks.unresolved_errors = "unknown";
  }

  // 5) 部署信息
  checks.commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";
  checks.launched = process.env.NEXT_PUBLIC_LAUNCHED === "1";

  return NextResponse.json(
    { healthy, ...checks, ts: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
