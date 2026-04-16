import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import EmbedView from './EmbedView'
import { buildEmbedStyle, getProviderById } from './providers'

export interface EmbedAttrs {
  src: string | null
  provider: string | null
  /** 用户原始输入的 URL，用于回填 Popover 和「打开原页面」，不参与渲染 */
  origin: string | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attrs: EmbedAttrs) => ReturnType
      updateEmbed: (attrs: EmbedAttrs) => ReturnType
    }
  }
}

/** 统一的第三方站点嵌入节点，存储 {src, provider, origin}，渲染为 div>iframe */
export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      provider: { default: null },
      origin: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-embed]',
        getAttrs: (node) => {
          const el = node as HTMLElement
          const iframe = el.querySelector('iframe')
          return {
            src: iframe?.getAttribute('src') ?? null,
            provider: el.getAttribute('data-provider') ?? null,
            origin: el.getAttribute('data-origin') ?? null,
          }
        },
      },
    ]
  },

  renderHTML({ node }) {
    const providerId = node.attrs.provider as string | null
    const src = node.attrs.src as string | null
    const origin = node.attrs.origin as string | null
    const provider = getProviderById(providerId)
    const style = provider ? buildEmbedStyle(provider) : 'aspect-ratio:16/9'
    const aspectRatio = provider?.aspectRatio ?? '16/9'

    const iframeAttrs: Record<string, string> = {
      src: src ?? '',
      loading: 'lazy',
      frameborder: '0',
      allow:
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
      allowfullscreen: 'true',
      referrerpolicy: 'strict-origin-when-cross-origin',
      ...(provider?.iframeAttrs ?? {}),
    }

    return [
      'div',
      mergeAttributes({
        'data-embed': '',
        'data-provider': providerId ?? '',
        'data-aspect-ratio': aspectRatio,
        'data-origin': origin ?? '',
        class: 'embed',
        style,
      }),
      ['iframe', iframeAttrs],
    ]
  },

  addCommands() {
    return {
      setEmbed:
        (attrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
      updateEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedView)
  },
})
