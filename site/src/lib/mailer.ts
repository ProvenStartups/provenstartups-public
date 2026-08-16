import { db, notifyQueue, users } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { SITE } from "./site";

/**
 * 发信管线。
 * 当前无付费发信服务(成本纪律:每项目固定月费≈$0),邮件写入 notify_queue。
 * 配置 MAILCHANNELS_* 或 RESEND_API_KEY 后 sendQueued() 自动开始真实投递;
 * 未配置时保持"未配置降级态"——邮件仍完整入队,不丢失,可随时补发。
 */
export function mailerConfigured(): boolean {
  return !!process.env.MAIL_WEBHOOK_URL;
}

export async function enqueue(toEmail: string, subject: string, bodyHtml: string) {
  await db.insert(notifyQueue).values({ toEmail, subject, bodyHtml });
}

/** 给所有开启通知的会员排队一封新项目提醒 */
export async function enqueueNewProjectAlert(items: { name: string; slug: string; tagline: string }[]) {
  if (items.length === 0) return 0;

  const members = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.plan, "member"), eq(users.notifyNewProjects, true)));

  if (members.length === 0) return 0;

  const list = items
    .map(
      (p) =>
        `<li style="margin:0 0 12px"><a href="${SITE.url}/projects/${p.slug}" style="color:#047857;font-weight:600;text-decoration:none">${p.name}</a><br><span style="color:#57534e;font-size:14px">${p.tagline}</span></li>`
    )
    .join("");

  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 4px;font-size:20px">${items.length} new proven idea${items.length > 1 ? "s" : ""}</h2>
<p style="margin:0 0 20px;color:#78716c;font-size:14px">Fresh breakdowns just landed on ${SITE.name}.</p>
<ul style="padding-left:18px;margin:0 0 24px">${list}</ul>
<a href="${SITE.url}/projects" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">See all ideas</a>
<p style="margin:28px 0 0;color:#a8a29e;font-size:12px">You're getting this because new-idea alerts are on for your Pro account. <a href="${SITE.url}/account" style="color:#a8a29e">Turn them off</a>.</p>
</div>`;

  const subject =
    items.length === 1
      ? `New proven idea: ${items[0].name}`
      : `${items.length} new proven startup ideas`;

  for (const m of members) {
    await enqueue(m.email, subject, html);
  }
  return members.length;
}

/** 消费队列。未配置发信服务时不改变队列状态(保持 queued,可补发)。 */
export async function sendQueued(limit = 50): Promise<{ sent: number; failed: number; skipped: number }> {
  const rows = await db
    .select()
    .from(notifyQueue)
    .where(eq(notifyQueue.status, "queued"))
    .limit(limit);

  if (!mailerConfigured()) return { sent: 0, failed: 0, skipped: rows.length };

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const res = await fetch(process.env.MAIL_WEBHOOK_URL!, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.MAIL_WEBHOOK_TOKEN
            ? { authorization: `Bearer ${process.env.MAIL_WEBHOOK_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          to: row.toEmail,
          from: `${SITE.name} <noreply@${SITE.domain}>`,
          subject: row.subject,
          html: row.bodyHtml,
        }),
      });
      if (!res.ok) throw new Error(`mail webhook ${res.status}`);
      await db
        .update(notifyQueue)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(notifyQueue.id, row.id));
      sent++;
    } catch (e) {
      await db
        .update(notifyQueue)
        .set({
          status: "failed",
          lastError: e instanceof Error ? e.message.slice(0, 400) : "unknown",
        })
        .where(eq(notifyQueue.id, row.id));
      failed++;
    }
  }
  return { sent, failed, skipped: 0 };
}

export { sql };
