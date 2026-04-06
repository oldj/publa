'use client'
import myModal from '@/app/(admin)/_components/myModals'
import { notify } from '@/lib/notify'
import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { useCurrentUser } from '../../_components/AdminCountsContext'
import adminStyles from '../../_components/AdminShell.module.scss'

import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'

interface User {
  id: number
  username: string
  email: string | null
  role: string
  createdAt: string
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

  const isEditor = currentUser?.role === 'editor'

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users')
    const json = await res.json()
    if (json.success) setUserList(json.data)
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
              <Table.Th>创建时间</Table.Th>
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
                    <Badge color={r.color} variant="light">
                      {r.label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {dayjs(u.createdAt).format('YYYY-MM-DD')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {operable && (
                      <Group gap="xs">
                        <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(u)}>
                          <IconEdit size={16} />
                        </ActionIcon>
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
                    )}
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
    </div>
  )
}
