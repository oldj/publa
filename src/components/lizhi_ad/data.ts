/**
 * data.ts
 */

type PlatformType = 'android' | 'ios' | 'web' | 'win32' | 'darwin' | 'linux'

export interface IAdItem {
  title: string
  icon: string
  url: string
  desc?: string
  platform?: PlatformType[]
}

export const items: IAdItem[] = [
  {
    title: 'Affinity Designer',
    icon: '/images/lizhi/Affinity_Designer.png',
    url: 'https://store.lizhi.io/site/products/id/277?cid=sk8efs9l',
    desc: '矢量图形设计工具 支持AI',
  },
  // {
  //   title: 'EssentialPIM',
  //   icon: '/images/lizhi/EssentialPIM.png',
  //   url: 'https://store.lizhi.io/site/products/id/74?cid=sk8efs9l',
  //   desc: '个人信息管理工具 日程邮件整理',
  // },
  {
    title: '亿图图示 Edraw Max',
    icon: '/images/lizhi/Edraw.png',
    url: 'https://store.lizhi.io/site/products/id/536?cid=sk8efs9l',
    desc: '专业办公作图软件 支持思维导图 流程图 工业设计图',
  },
  {
    title: 'IntelliJ IDEA Ultimate',
    icon: '/images/lizhi/IntelliJ_IDEA.png',
    url: 'https://store.lizhi.io/site/products/id/417?cid=sk8efs9l',
    desc: '全能开发工具 支持 Java 等多种语言',
  },
  {
    title: 'MarginNote 3',
    icon: '/images/lizhi/marginnote.png',
    url: 'https://store.lizhi.io/site/products/id/42?cid=sk8efs9l',
    desc: 'Mac 端 PDF 阅读批注工具',
    platform: ['darwin'],
  },
  {
    title: 'Microsoft Office',
    icon: '/images/lizhi/office365.png',
    url: 'https://store.lizhi.io/site/products/id/65?cid=sk8efs9l',
    desc: 'Office 365 个人版家庭版 | Office 2021 Office 2019 密钥',
  },
  {
    title: 'PDF Expert 2',
    icon: '/images/lizhi/pdf_expert.png',
    url: 'https://store.lizhi.io/site/products/id/61?cid=sk8efs9l',
    desc: 'Mac上优秀的 PDF 阅读编辑工具',
    platform: ['darwin'],
  },
  {
    title: 'PixelSnap',
    icon: '/images/lizhi/PixelSnap.png',
    url: 'https://store.lizhi.io/site/products/id/382?cid=sk8efs9l',
    desc: '界面元素测量参考线 设计辅助工具',
    platform: ['darwin'],
  },
  {
    title: 'QSpace',
    icon: '/images/lizhi/QSpace.png',
    url: 'https://store.lizhi.io/site/products/id/534?cid=sk8efs9l',
    desc: 'Mac 高效多视图文件管理器 代替访达',
    platform: ['darwin'],
  },
  {
    title: 'Scapple',
    icon: '/images/lizhi/Scapple.png',
    url: 'https://store.lizhi.io/site/products/id/219?cid=sk8efs9l',
    desc: '轻量级思维导图脑图软件',
    platform: ['darwin'],
  },
  {
    title: 'Scrivener',
    icon: '/images/lizhi/Scrivener.png',
    url: 'https://store.lizhi.io/site/products/id/221?cid=sk8efs9l',
    desc: '跨平台长文写作利器',
  },
  {
    title: 'Snipaste',
    icon: '/images/lizhi/snipaste.png',
    url: 'https://store.lizhi.io/site/products/id/273?cid=sk8efs9l',
    desc: '专业截屏贴图 标注取色工具',
  },
  {
    title: 'Typora',
    icon: '/images/lizhi/typora.png',
    url: 'https://store.lizhi.io/site/products/id/520?cid=sk8efs9l',
    desc: '跨平台 Markdown 编辑器 所见即所得 支持 Latex 公式',
  },
  {
    title: 'WonderPen',
    icon: '/images/lizhi/wonderpen.png',
    url: 'https://store.lizhi.io/site/products/id/101?cid=sk8efs9l',
    desc: '专业写作软件 多种导出格式',
  },
  {
    title: 'XMind',
    icon: '/images/lizhi/xmind.png',
    url: 'https://store.lizhi.io/site/products/id/47?cid=sk8efs9l',
    desc: '全平台思维导图软件 一键演示导图 支持智能配色',
  },
  {
    title: '万兴 PDF 专家',
    icon: '/images/lizhi/万兴PDF专家.png',
    url: 'https://store.lizhi.io/site/products/id/93?cid=sk8efs9l',
    desc: 'PDF修改编辑软件 原 PDFelement 7',
  },
]
