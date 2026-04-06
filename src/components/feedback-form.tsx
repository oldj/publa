/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

'use client'

import CaptchaInput from 'src/components/captcha-input'
import { GUESTBOOK_MAX_LENGTH } from 'src/lib/constants'
import { isBrowser } from 'src/lib/where'
import lodash from 'lodash'
import React, { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import Button from 'src/widgets/Button'
import dialog from 'src/widgets/dialog'

interface Props {
  onSuccess?: () => void
}

interface IFeedbackFields {
  username: string
  email: string
  url: string
  content: string
}

const FeedbackForm = (props: Props) => {
  const { onSuccess } = props
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm()
  const ref_form = useRef<HTMLFormElement>(null)
  const contentValue = watch('content', '')

  let refreshCaptcha = () => {}

  let _init_values: any = {}
  if (isBrowser()) {
    let c = localStorage.getItem('_cmt_cfg')
    if (c) {
      try {
        let d = JSON.parse(c)
        _init_values = { ...d }
      } catch (e) {}
    }
  }

  const onSubmit = async (values: { [x: string]: any }) => {
    // console.log(values)
    if (loading) return
    setLoading(true)

    _init_values = lodash.pick(values, ['username', 'email', 'url'])
    localStorage.setItem('_cmt_cfg', JSON.stringify(_init_values))

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
            title: '留言成功',
            message: '留言已收到，感谢您的留言！',
          })
          refreshCaptcha()
          reset({ content: '', captchaCode: '', ..._init_values })
          if (typeof onSuccess === 'function') {
            onSuccess()
          }
        } else if (r.code) {
          let message = '出错了，留言失败！'
          switch (r.code) {
            case 'INVALID_CAPTCHA':
              message = '请输入正确的验证码。'
              break
            case 'CONTENT_TOO_LONG':
              message = `留言内容不能超过 ${GUESTBOOK_MAX_LENGTH} 字符。`
              break
            case 'RATE_LIMITED':
              message = '提交过于频繁，请稍后再试。'
              break
          }

          dialog.Alert({
            icon: 'error',
            // title: '留言失败',
            message,
            onConfirm: () => {
              if (r.code === 'INVALID_CAPTCHA') {
                let ipt: HTMLInputElement | null | undefined = ref_form.current?.querySelector(
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
        dialog.Alert({ icon: 'error', message: '网络错误，请稍后重试。' })
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
        ref={ref_form}
      >
        <label>
          你的称呼 <span>*</span>
        </label>
        {/*label="你的称呼"*/}
        {/*name="username"*/}
        {/*rules={[{ required: true, message: '请输入你的称呼。' }]}*/}
        <input
          defaultValue={_init_values['username']}
          maxLength={50}
          required={true}
          {...register('username')}
        />

        {/*<Form.Item*/}
        {/*  label="电子邮件"*/}
        {/*  name="email"*/}
        {/*  rules={[*/}
        {/*    { required: true, message: '请输入你的 Email 地址。' },*/}
        {/*    { type: 'email', message: '请输入一个合法的 Email 地址。' },*/}
        {/*  ]}*/}
        {/*>*/}
        <label>
          电子邮件 <span>*</span>
        </label>
        <input
          defaultValue={_init_values['email']}
          maxLength={100}
          required={true}
          {...register('email')}
        />

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
          站点<span className="feedback-form-info">（选填）</span>
        </label>
        <input defaultValue={_init_values['url']} maxLength={200} {...register('url')} />

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
          留言 <span>*</span>
        </label>
        <textarea
          rows={8}
          minLength={3}
          maxLength={GUESTBOOK_MAX_LENGTH}
          defaultValue={_init_values['content']}
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
          验证码 <span>*</span>
          <span className="feedback-form-info">（不区分大小写）</span>
        </label>
        <CaptchaInput
          setRefresh={(fn: () => void) => (refreshCaptcha = fn)}
          required={true}
          {...register('captchaCode')}
        />

        <Button type="primary" htmlType="submit" size="large" disabled={loading} loading={loading}>
          {loading ? '提交中，请稍候……' : '提交留言'}
        </Button>
      </form>
    </div>
  )
}

export default FeedbackForm
