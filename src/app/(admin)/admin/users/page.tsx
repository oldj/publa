'use client'
import myModal from '@/app/(admin)/_components/myModals'
import { notify } from '@/lib/notify'
import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { useCurrentUser } from '../../_components/AdminCountsContext'
import adminStyles from '../../_components/AdminShell.module.scss'
import { NowrapBadge } from '../../_components/NowrapBadge'

import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Modal,
  Pagination,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconEdit, IconHistory, IconPlus, IconTrash } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'

interface User {
  id: number
  username: string
  email: string | null
  role: string
  createdAt: string
  lastActiveAt: string | null
}

interface ActivityLog {
  id: number
  action: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  login: '登录',
  logout: '登出',
  create_post: '创建文章',
  update_post: '更新文章',
  delete_post: '删除文章',
  create_page: '创建页面',
  update_page: '更新页面',
  delete_page: '删除页面',
  create_user: '创建用户',
  update_user: '更新用户',
  delete_user: '删除用户',
  create_category: '创建分类',
  update_category: '更新分类',
  delete_category: '删除分类',
  create_tag: '创建标签',
  update_tag: '更新标签',
  delete_tag: '删除标签',
  create_menu: '创建菜单',
  update_menu: '更新菜单',
  delete_menu: '删除菜单',
  moderate_comment: '审核评论',
  delete_comment: '删除评论',
  moderate_guestbook: '审核留言',
  delete_guestbook: '删除留言',
  upload_attachment: '上传附件',
  delete_attachment: '删除附件',
  update_settings: '更新设置',
  create_redirect: '创建重定向',
  update_redirect: '更新重定向',
  delete_redirect: '删除重定向',
  import_data: '导入数据',
  export_data: '导出数据',
}

const roleMap: Record<string, { label: string; color: string }> = {
  owner: { label: '站长', color: 'red' },
  admin: { label: '管理员', color: 'blue' },
  editor: { label: '编辑', color: 'green' },
}

export default function UsersPage() {
  const currentUser = useCurrentUser()
  const [userList, setUserList] = useState<User[]>([])
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'editor' })
  const [loading, setLoading] = useState(false)

  // 编辑 Drawer
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'editor',
  })
  const [editOpened, setEditOpened] = useState(false)

  // 活动日志 Drawer
  const [logsUser, setLogsUser] = useState<User | null>(null)
  const [logsOpened, setLogsOpened] = useState(false)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const logsPageSize = 30

  const isEditor = currentUser?.role === 'editor'
  const isAdmin = currentUser?.role === 'admin'

  /** 当前用户是否可查看目标用户的活动日志 */
  const canViewLogs = (target: { role: string }) => {
    if (isEditor) return false
    if (isAdmin && target.role === 'owner') return false
    return true
  }

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users')
    const json = await res.json()
    if (json.success) setUserList(json.data)
  }, [])

  const fetchActivityLogs = useCallback(async (userId: number, page: number) => {
    const res = await fetch(
      `/api/users/${userId}/activity-logs?page=${page}&pageSize=${logsPageSize}`,
    )
    const json = await res.json()
    if (json.success) {
      setLogs(json.data.items)
      setLogsTotal(json.data.total)
    }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    fetchUsers()
  }, [currentUser, fetchUsers])

  /** 当前用户是否可操作目标用户 */
  const canOperate = (target: User) => {
    if (!currentUser) return false
    if (currentUser.role === 'owner') return true
    if (currentUser.role === 'admin') return target.role === 'editor'
    if (currentUser.role === 'editor') return target.id === currentUser.id
    return false
  }

  const canDelete = (target: User) => {
    if (!currentUser) return false
    if (target.id === currentUser.id) return false
    return canOperate(target)
  }

  const handleCreate = async () => {
    const username = normalizeUsername(form.username)
    const email = normalizeEmail(form.email)
    const password = normalizePassword(form.password)

    if (!username || !password) {
      notify({ color: 'red', message: '用户名和密码不能为空' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          role: form.role,
        }),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: '创建成功' })
        closeCreate()
        setForm({ username: '', email: '', password: '', role: 'editor' })
        fetchUsers()
      } else {
        notify({ color: 'red', message: json.message || '创建失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (user: User) => {
    setEditUser(user)
    setEditForm({ username: user.username, email: user.email || '', password: '', role: user.role })
    setEditOpened(true)
  }

  const handleUpdate = async () => {
    if (!editUser) return
    const username = normalizeUsername(editForm.username)
    const email = normalizeEmail(editForm.email)
    const password = normalizePassword(editForm.password)

    if (!username) {
      notify({ color: 'red', message: '用户名不能为空' })
      return
    }

    if (editForm.password && !password) {
      notify({ color: 'red', message: '密码不能为空' })
      return
    }

    setLoading(true)
    try {
      const body: Record<string, string> = {
        username,
        email: email || '',
      }
      if (editForm.password) body.password = password
      if (currentUser?.role === 'owner') body.role = editForm.role

      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: '更新成功' })
        setEditOpened(false)
        fetchUsers()
      } else {
        notify({ color: 'red', message: json.message || '更新失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, username: string) => {
    if (!(await myModal.confirm({ message: `确定要删除用户「${username}」吗？` }))) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: '删除成功' })
      fetchUsers()
      if (editUser?.id === id) setEditOpened(false)
    } else {
      notify({ color: 'red', message: json.message || '删除失败' })
    }
  }

  // 站长可选管理员或编辑，管理员只能选编辑
  const roleOptions =
    currentUser?.role === 'owner'
      ? [
          { value: 'admin', label: '管理员' },
          { value: 'editor', label: '编辑' },
        ]
      : [{ value: 'editor', label: '编辑' }]

  if (!currentUser) {
    return null
  }

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={3}>用户管理</Title>
        {!isEditor && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            新建用户
          </Button>
        )}
      </Group>

      <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>用户名</Table.Th>
              <Table.Th>邮箱</Table.Th>
              <Table.Th>角色</Table.Th>
              <Table.Th>最后活跃</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {userList.map((u) => {
              const r = roleMap[u.role] || { label: u.role, color: 'gray' }
              const operable = canOperate(u)
              return (
                <Table.Tr key={u.id}>
                  <Table.Td>{u.username}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {u.email || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <NowrapBadge color={r.color} variant="light">
                      {r.label}
                    </NowrapBadge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {u.lastActiveAt ? dayjs(u.lastActiveAt).format('YYYY-MM-DD HH:mm') : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {canViewLogs(u) && (
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={() => {
                            setLogsUser(u)
                            setLogsPage(1)
                            fetchActivityLogs(u.id, 1)
                            setLogsOpened(true)
                          }}
                        >
                          <IconHistory size={16} />
                        </ActionIcon>
                      )}
                      {operable && (
                        <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(u)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      )}
                      {canDelete(u) && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDelete(u.id, u.username)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {/* 新建用户 Modal */}
      <Modal opened={createOpened} onClose={closeCreate} title="新建用户">
        <TextInput
          label="用户名"
          required
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <TextInput
          label="邮箱"
          mt="sm"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <PasswordInput
          label="密码"
          required
          mt="sm"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Select
          label="角色"
          mt="sm"
          data={roleOptions}
          value={form.role}
          onChange={(v) => setForm({ ...form, role: v || 'editor' })}
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closeCreate}>
            取消
          </Button>
          <Button onClick={handleCreate} loading={loading}>
            创建
          </Button>
        </Group>
      </Modal>

      {/* 编辑用户 Drawer */}
      <Drawer
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title="编辑用户"
        position="right"
        size="md"
      >
        {editUser && (
          <Stack gap="md">
            <Group gap="xs">
              <Badge color={roleMap[editUser.role]?.color || 'gray'} variant="light">
                {roleMap[editUser.role]?.label || editUser.role}
              </Badge>
              <Text size="xs" c="dimmed">
                创建于 {dayjs(editUser.createdAt).format('YYYY-MM-DD HH:mm')}
              </Text>
            </Group>

            <Divider />

            <TextInput
              label="用户名"
              required
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
            />
            <TextInput
              label="邮箱"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
            <PasswordInput
              label="密码"
              description="留空则不修改"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            />
            {currentUser?.role === 'owner' && editUser.id !== currentUser.id && (
              <Select
                label="角色"
                data={[
                  { value: 'owner', label: '站长' },
                  { value: 'admin', label: '管理员' },
                  { value: 'editor', label: '编辑' },
                ]}
                value={editForm.role}
                onChange={(v) => setEditForm({ ...editForm, role: v || editForm.role })}
              />
            )}

            <Group mt="md">
              <Button onClick={handleUpdate} loading={loading}>
                保存
              </Button>
              {canDelete(editUser) && (
                <Button
                  variant="light"
                  color="red"
                  onClick={() => handleDelete(editUser.id, editUser.username)}
                >
                  删除用户
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Drawer>

      {/* 活动日志 Drawer */}
      <Drawer
        opened={logsOpened}
        onClose={() => setLogsOpened(false)}
        title={`活动日志 — ${logsUser?.username || ''}`}
        position="right"
        size="lg"
      >
        {logs.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            暂无活动记录
          </Text>
        ) : (
          <Stack gap="md">
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>操作</Table.Th>
                  <Table.Th>IP</Table.Th>
                  <Table.Th>时间</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>
                      <NowrapBadge variant="light" size="sm">
                        {ACTION_LABELS[log.action] || log.action}
                      </NowrapBadge>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={log.userAgent || '-'} multiline maw={400}>
                        <Text size="sm" c="dimmed" style={{ cursor: 'help' }}>
                          {log.ipAddress || '-'}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {Math.ceil(logsTotal / logsPageSize) > 1 && (
              <Group justify="center">
                <Pagination
                  total={Math.ceil(logsTotal / logsPageSize)}
                  value={logsPage}
                  onChange={(p) => {
                    setLogsPage(p)
                    if (logsUser) fetchActivityLogs(logsUser.id, p)
                  }}
                />
              </Group>
            )}
          </Stack>
        )}
      </Drawer>
    </div>
  )
}
