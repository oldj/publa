/** 从请求中提取客户端 IP 和 User-Agent */
export function getRequestInfo(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : request.headers.get('x-real-ip') || ''
  const ua = request.headers.get('user-agent') || ''
  return { ip, ua }
}
