/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import lodash from 'lodash'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import CaptchaInput from 'src/components/captcha-input'
import { COMMENT_MAX_LENGTH } from 'src/lib/constants'
import Button from 'src/widgets/Button'
import dialog from '../widgets/dialog'

interface Props {
  contentId: number
  parentId?: number
  onSuccess?: (data?: any) => void
}

const CommentForm = (props: Props) => {
  const { contentId, parentId, onSuccess } = props
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

  let refreshCaptcha = () => {}

  // 从 localStorage 恢复用户信息，放在 useEffect 中避免水合不匹配
  useEffect(() => {
    try {
      const c = localStorage.getItem('_cmt_cfg')
      if (c) {
        const d = JSON.parse(c)
        reset({ contentId, parentId, ...d })
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

    fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
      .then((res) => res.json())
      .then((r) => {
        // console.log(r)
        if (r && r.success) {
          let message: string =
            r.data && r.data.status === 'approved'
              ? '评论成功，感谢你的评论！'
              : '评论成功，将在审核后展示！'

          // alert(msg)
          dialog.Alert({
            icon: 'success',
            title: '评论成功',
            message,
          })

          // form.setFieldsValue({ content: '', captchaCode: '' })
          refreshCaptcha()
          const cached = lodash.pick(values, ['username', 'email', 'url'])
          reset({ contentId, parentId, content: '', captchaCode: '', ...cached })
          if (typeof onSuccess === 'function') {
            onSuccess(r.data)
          }
        } else if (r.code) {
          let message = '出错了，评论失败！'
          switch (r.code) {
            case 'INVALID_CAPTCHA':
              message = '请输入正确的验证码。'
              break
            case 'COMMENT_DISABLED':
              message = '该文章不可评论！'
              break
            case 'CONTENT_TOO_LONG':
              message = `评论内容不能超过 ${COMMENT_MAX_LENGTH} 字符。`
              break
            case 'RATE_LIMITED':
              message = '提交过于频繁，请稍后再试。'
              break
          }

          // alert(message.toString())
          dialog.Alert({
            icon: 'error',
            // title: '评论失败',
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
        dialog.Alert({ icon: 'error', message: '网络错误，请稍后重试。' })
      })
      .finally(() => {
        // refreshCaptcha()
        setTimeout(() => setLoading(false), 1000)
      })
  }

  // const onFinishFailed = (errorInfo: any) => {
  //   console.log('Failed:', errorInfo)
  // }

  return (
    <div className="comment-form">
      <form
        name="comment"
        // form={form}
        // onFinish={onFinish}
        // onFinishFailed={onFinishFailed}
        // layout="vertical"
        // initialValues={{
        //   contentId,
        //   parentId,
        //   ..._init_values,
        // }}
        // validateTrigger="onBlur"
        onSubmit={handleSubmit(onSubmit)}
        ref={refForm}
      >
        {/*<Form.Item name="contentId" noStyle>*/}
        {/*  <Input type="hidden" />*/}
        {/*</Form.Item>*/}
        <input type={'hidden'} value={contentId} {...register('contentId')} />

        {/*<Form.Item name="parentId" noStyle>*/}
        {/*  <Input type="hidden" />*/}
        {/*</Form.Item>*/}
        <input type={'hidden'} value={parentId} {...register('parentId')} />

        {/*<Form.Item*/}
        {/*  label="评论"*/}
        {/*  name="content"*/}
        {/*  rules={[*/}
        {/*    { required: true, message: '请输入评论内容。' },*/}
        {/*    { min: 3, message: '评论不能太短哦。' },*/}
        {/*  ]}*/}
        {/*>*/}
        {/*  <Input.TextArea rows={8} maxLength={4096} />*/}
        {/*</Form.Item>*/}

        <label>
          评论 <span>*</span>
        </label>
        <textarea
          required={true}
          minLength={3}
          maxLength={COMMENT_MAX_LENGTH}
          rows={8}
          {...register('content')}
        />
        <span className="comment-form-info">
          {contentValue?.length || 0} / {COMMENT_MAX_LENGTH}
        </span>

        {/*<Form.Item*/}
        {/*  label="你的称呼"*/}
        {/*  name="username"*/}
        {/*  rules={[{ required: true, message: '请输入你的称呼。' }]}*/}
        {/*>*/}
        {/*  <Input maxLength={50} />*/}
        {/*</Form.Item>*/}
        <label>
          你的称呼 <span>*</span>
        </label>
        <input required={true} maxLength={50} {...register('username')} />

        {/*<Form.Item*/}
        {/*  label="电子邮件"*/}
        {/*  name="email"*/}
        {/*  rules={[*/}
        {/*    { required: true, message: '请输入你的 Email 地址。' },*/}
        {/*    { type: 'email', message: '请输入一个合法的 Email 地址。' },*/}
        {/*  ]}*/}
        {/*>*/}
        {/*  <Input maxLength={100} />*/}
        {/*</Form.Item>*/}
        <label>
          电子邮件 <span>*</span>
        </label>
        <input required={true} type={'email'} maxLength={100} {...register('email')} />

        {/*<Form.Item*/}
        {/*  label={*/}
        {/*    <>*/}
        {/*      站点<span className="comment-form-info">（选填）</span>*/}
        {/*    </>*/}
        {/*  }*/}
        {/*  name="url"*/}
        {/*  rules={[{ required: false }, { type: 'url', message: '请输入一个合法的 URL 地址。' }]}*/}
        {/*>*/}
        {/*  <Input maxLength={200} />*/}
        {/*</Form.Item>*/}
        <label>
          站点<span className="comment-form-info">（选填）</span>
        </label>
        <input type={'url'} maxLength={200} {...register('url')} />

        {/*<Form.Item*/}
        {/*  label={*/}
        {/*    <>*/}
        {/*      验证码<span className="comment-form-info">（不区分大小写）</span>*/}
        {/*    </>*/}
        {/*  }*/}
        {/*  name="captchaCode"*/}
        {/*  rules={[{ required: true, message: '请输入验证码（不区分大小写）。' }]}*/}
        {/*>*/}
        {/*  <CaptchaInput setRefresh={(fn) => (refreshCaptcha = fn)} />*/}
        {/*</Form.Item>*/}
        <label>
          验证码 <span>*</span>
          <span className="comment-form-info">（不区分大小写）</span>
        </label>
        <CaptchaInput
          setRefresh={(fn: () => void) => (refreshCaptcha = fn)}
          required={true}
          {...register('captchaCode')}
        />

        {/*<Form.Item className={styles.submit}>*/}
        {/*  <Button*/}
        {/*    type="primary"*/}
        {/*    htmlType="submit"*/}
        {/*    size="large"*/}
        {/*    disabled={loading}*/}
        {/*    loading={loading}*/}
        {/*  >*/}
        {/*    {loading ? '提交中，请稍候……' : '提交评论'}*/}
        {/*  </Button>*/}
        {/*</Form.Item>*/}
        <Button type="primary" htmlType="submit" size="large" disabled={loading} loading={loading}>
          {loading ? '提交中，请稍候……' : '提交评论'}
        </Button>
      </form>
    </div>
  )
}

export default CommentForm
