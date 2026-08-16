import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";
import { SITE } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const LAUNCHED = process.env.NEXT_PUBLIC_LAUNCHED === "1";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  // 开发期全站 noindex(两级之二);上线设 NEXT_PUBLIC_LAUNCHED=1 摘除
  robots: LAUNCHED ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: {
    siteName: SITE.name,
    type: "website",
    url: SITE.url,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteId = process.env.NEXT_PUBLIC_FLOWGLANCE_SITE;

  return (
    <ClerkProvider
      appearance={{
        // 值必须与 globals.css 的 @theme 令牌逐一对应。Clerk 从 colorPrimary
        // 推导按钮底色、focus 环与链接色 —— 之前这里是 #fafafa,推出来的主按钮
        // 是近白底配白字(对比度 1.02:1),等于按钮隐身。
        //
        // 注意:Clerk 6 的 colorText/colorTextSecondary/colorInputText/colorAlphaShade
        // 在 7 里全部改名(→ colorForeground / colorMutedForeground /
        // colorInputForeground / colorNeutral),用旧名会挂类型检查。不是"只认三个键"。
        variables: {
          colorPrimary: "#5b4bf5", // --color-brand
          colorPrimaryForeground: "#ffffff",
          colorForeground: "#0f172a", // --color-t1
          colorMutedForeground: "#53617a", // --color-t2
          colorBackground: "#ffffff", // --color-s1,卡片坐在 --color-bg 上要更亮
          colorMuted: "#f4f6fb", // --color-s2
          colorInput: "#ffffff",
          colorInputForeground: "#0f172a",
          // colorBorder 是"基色"不是成品色 —— Clerk 会给它叠 11% alpha 再画描边。
          // 传 --color-line(#e6eaf3)那种已经很浅的值,淡化后与白底只差 0.3%,
          // 输入框看起来就没有边。传墨色让它自己淡:11% 落在 ~#e5e6e8,与 --color-line 基本一致。
          colorBorder: "#0f172a",
          colorRing: "#5b4bf5",
          colorDanger: "#e11d48",
          colorSuccess: "#059669", // --color-money
          colorWarning: "#d97706",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <Analytics />
          {/* FlowGlance —— 第三方访客分析,与上面自建的 /api/track 并存:
              自建那套只记 pageview 与业务事件(入 Neon,健康检查读它),
              FlowGlance 补的是会话回放层面的东西(滚动、点击热区、表单放弃)。
              data-site 是公开 ID(fw_pub_),放进仓库没有泄密问题;走环境变量是为了
              让预览环境能不挂,免得把预览流量混进生产站的数据里。 */}
          {siteId ? (
            <Script
              src="https://flowglance.com/fw.js"
              data-site={siteId}
              strategy="afterInteractive"
            />
          ) : null}
        </body>
      </html>
    </ClerkProvider>
  );
}
