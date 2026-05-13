/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

'use client'

import lodash from 'lodash'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import CaptchaInput, { type CaptchaInputHandle } from 'src/components/captcha-input'
import { GUESTBOOK_MAX_LENGTH } from 'src/lib/constants'
import Button from 'src/widgets/Button'
import dialog from 'src/widgets/dialog'

interface Props {
  onSuccess?: () => void
}

const FeedbackForm = (props: Props) => {
  const { onSuccess } = props
  const t = useTranslations('frontend.guestbook.form')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors: _errors },
  } = useForm()
  const refForm = useRef<HTMLFormElement>(null)
  const contentValue = watch('content', '')

  // CaptchaInput 通过 useImperativeHandle 暴露 refresh() 方法
  const captchaInputRef = useRef<CaptchaInputHandle>(null)
  // register 的 ref 单独取出给内部 <input>，imperative handle 走外层 ref
  const { ref: captchaInputDomRef, ...captchaRegister } = register('captchaCode')

  // 从 localStorage 恢复用户信息，放在 useEffect 中避免水合不匹配
  useEffect(() => {
    try {
      const c = localStorage.getItem('_cmt_cfg')
      if (c) {
        const d = JSON.parse(c)
        reset(d)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const onSubmit = async (values: { [x: string]: any }) => {
    // console.log(values)
    if (loading) return
    setLoading(true)

    const cached = lodash.pick(values, ['username', 'email', 'url'])
    localStorage.setItem('_cmt_cfg', JSON.stringify(cached))

    fetch('/api/guestbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
      .then((res) => res.json())
      .then((r) => {
        // console.log(r)
        if (r && r.success) {
          dialog.Alert({
            icon: 'success',
            title: t('successTitle'),
            message: t('successMessage'),
          })
          captchaInputRef.current?.refresh()
          const cached = lodash.pick(values, ['username', 'email', 'url'])
          // 清空字段放在 spread 之后，避免 cached 未来扩展时把空值覆盖掉
          reset({ ...cached, content: '', captchaCode: '' })
          if (typeof onSuccess === 'function') {
            onSuccess()
          }
        } else if (r.code) {
          let message = t('errors.general')
          switch (r.code) {
            case 'INVALID_CAPTCHA':
              message = t('errors.invalidCaptcha')
              break
            case 'CONTENT_TOO_LONG':
              message = t('errors.contentTooLong', { max: GUESTBOOK_MAX_LENGTH })
              break
            case 'RATE_LIMITED':
              message = t('errors.rateLimited')
              break
          }

          // 后端在 meta.captchaShouldRefresh 显式告知本次失败是否需要前端刷新 captcha，
          // 由后端单方面维护"用户 captcha 状态是否仍可用"的事实，前端无需枚举 code。
          if (r.meta?.captchaShouldRefresh) {
            captchaInputRef.current?.refresh()
            reset({ ...values, captchaCode: '' })
          }

          dialog.Alert({
            icon: 'error',
            // title: '留言失败',
            message,
            onConfirm: () => {
              if (r.code === 'INVALID_CAPTCHA') {
                let ipt: HTMLInputElement | null | undefined = refForm.current?.querySelector(
                  'input[name="captchaCode"]',
                )
                ipt?.focus()
              }
            },
          })
        }
      })
      .catch((e) => {
        console.error(e)
        dialog.Alert({ icon: 'error', message: t('errors.network') })
      })
      .finally(() => {
        // refreshCaptcha()
        setTimeout(() => setLoading(false), 1000)
      })
  }

  return (
    <div className="feedback-form">
      <form
        name="feedback"
        // initialValues={{
        //   ..._init_values,
        // }}
        onSubmit={handleSubmit(onSubmit)}
        ref={refForm}
      >
        <label>
          {t('fields.username')} <span>*</span>
        </label>
        {/*label="你的称呼"*/}
        {/*name="username"*/}
        {/*rules={[{ required: true, message: '请输入你的称呼。' }]}*/}
        <input maxLength={50} required={true} {...register('username')} />

        {/*<Form.Item*/}
        {/*  label="电子邮件"*/}
        {/*  name="email"*/}
        {/*  rules={[*/}
        {/*    { required: true, message: '请输入你的 Email 地址。' },*/}
        {/*    { type: 'email', message: '请输入一个合法的 Email 地址。' },*/}
        {/*  ]}*/}
        {/*>*/}
        <label>
          {t('fields.email')} <span>*</span>
        </label>
        <input maxLength={100} required={true} {...register('email')} />

        {/*<Form.Item*/}
        {/*  label={*/}
        {/*    <>*/}
        {/*      站点<span className="feedback-form-info">（选填）</span>*/}
        {/*    </>*/}
        {/*  }*/}
        {/*  name="url"*/}
        {/*  rules={[{ required: false }, { type: 'url', message: '请输入一个合法的 URL 地址。' }]}*/}
        {/*>*/}
        <label>
          {t('fields.website')}
          <span className="feedback-form-info">{tCommon('labels.optional')}</span>
        </label>
        <input maxLength={200} {...register('url')} />

        {/*<Form.Item*/}
        {/*  label="留言"*/}
        {/*  name="content"*/}
        {/*  rules={[*/}
        {/*    { required: true, message: '请输入留言内容。' },*/}
        {/*    { min: 3, message: '再写一点吧……' },*/}
        {/*  ]}*/}
        {/*>*/}
        {/*  <Input.TextArea rows={8} maxLength={4096} />*/}
        {/*</Form.Item>*/}
        <label>
          {t('fields.content')} <span>*</span>
        </label>
        <textarea
          rows={8}
          minLength={3}
          maxLength={GUESTBOOK_MAX_LENGTH}
          required={true}
          {...register('content')}
        />
        <span className="feedback-form-info">
          {contentValue?.length || 0} / {GUESTBOOK_MAX_LENGTH}
        </span>

        {/*<Form.Item*/}
        {/*  label={*/}
        {/*    <>*/}
        {/*      验证码<span className="feedback-form-info">（不区分大小写）</span>*/}
        {/*    </>*/}
        {/*  }*/}
        {/*  name="captchaCode"*/}
        {/*  rules={[{ required: true, message: '请输入验证码（不区分大小写）。' }]}*/}
        {/*>*/}
        {/*  <CaptchaInput setRefresh={(fn) => (refreshCaptcha = fn)} />*/}
        {/*</Form.Item>*/}
        <label>
          {t('fields.captcha')} <span>*</span>
          <span className="feedback-form-info">{tCommon('labels.caseInsensitive')}</span>
        </label>
        <CaptchaInput
          ref={captchaInputRef}
          inputRef={captchaInputDomRef}
          required={true}
          {...captchaRegister}
        />

        <Button type="primary" htmlType="submit" size="large" disabled={loading} loading={loading}>
          {loading ? t('submitting') : t('submit')}
        </Button>
      </form>
    </div>
  )
}

export default FeedbackForm
