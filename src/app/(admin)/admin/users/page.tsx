'use client'
import myModal from '@/app/(admin)/_components/myModals'
import { SafeDrawer } from '@/components/SafeDrawer'
import { notify } from '@/lib/notify'
import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { useCurrentUser } from '../../_components/AdminCountsContext'
import adminStyles from '../../_components/AdminShell.module.scss'
import { NowrapBadge } from '../../_components/NowrapBadge'
import { RoleLabel } from '../../_components/RoleLabel'

import {
  ActionIcon,
  Box,
  Button,
  Divider,
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
import { useTranslations } from 'next-intl'
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

export default function UsersPage() {
  const t = useTranslations('admin.usersPage')
  const tCommon = useTranslations('common')
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
      notify({ color: 'red', message: t('validation.usernameAndPasswordRequired') })
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
        notify({ color: 'green', message: tCommon('messages.createSuccess') })
        closeCreate()
        setForm({ username: '', email: '', password: '', role: 'editor' })
        fetchUsers()
      } else {
        notify({ color: 'red', message: json.message || t('messages.createFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
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
      notify({ color: 'red', message: t('validation.usernameRequired') })
      return
    }

    if (editForm.password && !password) {
      notify({ color: 'red', message: t('validation.passwordRequired') })
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
        notify({ color: 'green', message: tCommon('messages.updateSuccess') })
        setEditOpened(false)
        fetchUsers()
      } else {
        notify({ color: 'red', message: json.message || t('messages.updateFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, username: string) => {
    if (!(await myModal.confirm({ message: t('deleteConfirm', { username }) }))) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: tCommon('messages.deleteSuccess') })
      fetchUsers()
      if (editUser?.id === id) setEditOpened(false)
    } else {
      notify({ color: 'red', message: json.message || t('messages.deleteFailed') })
    }
  }

  // 站长可选管理员或编辑，管理员只能选编辑
  const roleOptions =
    currentUser?.role === 'owner'
      ? [
          { value: 'admin', label: t('roleOptions.admin') },
          { value: 'editor', label: t('roleOptions.editor') },
        ]
      : [{ value: 'editor', label: t('roleOptions.editor') }]

  if (!currentUser) {
    return null
  }

  return (
    <Box mt="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>{t('title')}</Title>
        {!isEditor && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            {t('newUser')}
          </Button>
        )}
      </Group>

      <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('columns.username')}</Table.Th>
              <Table.Th>{t('columns.email')}</Table.Th>
              <Table.Th>{t('columns.role')}</Table.Th>
              <Table.Th>{t('columns.lastActive')}</Table.Th>
              <Table.Th>{t('columns.actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {userList.map((u) => {
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
                    <RoleLabel role={u.role} />
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
      <Modal opened={createOpened} onClose={closeCreate} title={t('createTitle')}>
        <TextInput
          label={t('fields.username')}
          required
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <TextInput
          label={t('fields.email')}
          mt="sm"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <PasswordInput
          label={t('fields.password')}
          required
          mt="sm"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Select
          label={t('fields.role')}
          mt="sm"
          data={roleOptions}
          value={form.role}
          onChange={(v) => setForm({ ...form, role: v || 'editor' })}
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closeCreate}>
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={handleCreate} loading={loading}>
            {tCommon('actions.create')}
          </Button>
        </Group>
      </Modal>

      {/* 编辑用户 Drawer */}
      <SafeDrawer
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title={t('editTitle')}
        position="right"
        size="md"
      >
        {editUser && (
          <Stack gap="md">
            <Group gap="xs">
              <RoleLabel role={editUser.role} />
              <Text size="xs" c="dimmed">
                {t('createdAt', { time: dayjs(editUser.createdAt).format('YYYY-MM-DD HH:mm') })}
              </Text>
            </Group>

            <Divider />

            <TextInput
              label={t('fields.username')}
              required
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
            />
            <TextInput
              label={t('fields.email')}
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
            <PasswordInput
              label={t('fields.password')}
              description={t('passwordOptionalDescription')}
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            />
            {currentUser?.role === 'owner' && editUser.id !== currentUser.id && (
              <Select
                label={t('fields.role')}
                data={[
                  { value: 'owner', label: t('roleOptions.owner') },
                  { value: 'admin', label: t('roleOptions.admin') },
                  { value: 'editor', label: t('roleOptions.editor') },
                ]}
                value={editForm.role}
                onChange={(v) => setEditForm({ ...editForm, role: v || editForm.role })}
              />
            )}

            <Group mt="md">
              <Button onClick={handleUpdate} loading={loading}>
                {tCommon('actions.save')}
              </Button>
              {canDelete(editUser) && (
                <Button
                  variant="light"
                  color="red"
                  onClick={() => handleDelete(editUser.id, editUser.username)}
                >
                  {t('deleteUser')}
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </SafeDrawer>

      {/* 活动日志 Drawer */}
      <SafeDrawer
        opened={logsOpened}
        onClose={() => setLogsOpened(false)}
        title={t('activityTitle', { username: logsUser?.username || '' })}
        position="right"
        size="lg"
      >
        {logs.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {t('emptyLogs')}
          </Text>
        ) : (
          <Stack gap="md">
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('activityColumns.action')}</Table.Th>
                  <Table.Th>{t('activityColumns.ip')}</Table.Th>
                  <Table.Th>{t('activityColumns.time')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>
                      <NowrapBadge variant="light" size="sm">
                        {t.has(`activityLabels.${log.action}` as any)
                          ? t(`activityLabels.${log.action}` as any)
                          : log.action}
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
      </SafeDrawer>
    </Box>
  )
}
