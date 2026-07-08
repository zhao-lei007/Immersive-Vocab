import { Still } from "remotion"
import { StoreShot } from "./StoreShot"

const SHOTS = [
  {
    id: "shot-01",
    screenshot: "shot-01.png",
    title: "查词即收藏，阅读中积累词汇",
    subtitle: "词典弹窗给出音标、词性、释义，一键存入生词本",
  },
  {
    id: "shot-02",
    screenshot: "shot-02.png",
    title: "全文双语对照，读原文不再费劲",
    subtitle: "沉浸式翻译，原文译文逐段对照，支持本地与自定义 AI 模型",
  },
  {
    id: "shot-03",
    screenshot: "shot-03.png",
    title: "整句挑词收藏，闪卡到期复习",
    subtitle: "从划选的句子里挑出生词，间隔重复提醒，读过的词不再忘记",
  },
] as const

export function RemotionRoot() {
  return (
    <>
      {SHOTS.map(shot => (
        <Still
          key={shot.id}
          id={shot.id}
          component={StoreShot}
          width={1280}
          height={800}
          defaultProps={{
            screenshot: shot.screenshot,
            title: shot.title,
            subtitle: shot.subtitle,
          }}
        />
      ))}
    </>
  )
}
