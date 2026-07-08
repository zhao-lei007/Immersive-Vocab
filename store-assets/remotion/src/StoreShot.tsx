import { AbsoluteFill, Img, staticFile } from "remotion"

// Chrome 商店截图版式：品牌绿渐变背景 + 中文标题 + 真实窗口截图
export interface StoreShotProps {
  screenshot: string
  title: string
  subtitle: string
}

const FONT_STACK
  = "'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', Arial, sans-serif"

export function StoreShot({ screenshot, title, subtitle }: StoreShotProps) {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 55%, #a7f3d0 100%)",
        fontFamily: FONT_STACK,
        overflow: "hidden",
      }}
    >
      {/* 右上角品牌标识 */}
      <div
        style={{
          position: "absolute",
          top: 28,
          right: 36,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Img src={staticFile("logo.png")} style={{ width: 30, height: 30, borderRadius: 7 }} />
        <span style={{ fontSize: 19, fontWeight: 600, color: "#065f46" }}>
          Immersive Vocab · 沉浸式背单词
        </span>
      </div>

      {/* 标题区 */}
      <div style={{ padding: "40px 64px 0" }}>
        <h1
          style={{
            margin: 0,
            fontSize: 50,
            fontWeight: 700,
            letterSpacing: 1,
            color: "#064e3b",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 24,
            fontWeight: 400,
            color: "#047857",
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* 截图区：真实 Chrome 窗口，带投影，底部略微出血 */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 34 }}>
        <Img
          src={staticFile(screenshot)}
          style={{
            width: 1180,
            borderRadius: 12,
            boxShadow: "0 24px 60px rgba(6, 78, 59, 0.28)",
          }}
        />
      </div>
    </AbsoluteFill>
  )
}
