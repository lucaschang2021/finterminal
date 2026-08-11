/** 本地多用户登录（localStorage），密码仅存不可逆哈希 */

export interface UserRecord {
  passHash: string
  remember: boolean
  createdAt: number
}

const USERS_KEY = 'finterminal_users'
const CURRENT_KEY = 'finterminal_current_user'

export function loadUsers(): Record<string, UserRecord> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveUsers(users: Record<string, UserRecord>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

/** djb2 简单哈希（本地演示用途，非安全场景） */
export function hashPass(pw: string): string {
  let h = 5381
  const s = `ft::${pw}::finterminal`
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  }
  return `h${h.toString(16)}`
}

export function register(name: string, pw: string): boolean {
  const users = loadUsers()
  const key = name.trim()
  if (!key || users[key]) return false
  users[key] = { passHash: hashPass(pw), remember: false, createdAt: Date.now() }
  saveUsers(users)
  return true
}

export function login(name: string, pw: string): boolean {
  const users = loadUsers()
  const rec = users[name.trim()]
  return !!rec && rec.passHash === hashPass(pw)
}

export function setRemember(name: string, remember: boolean) {
  const users = loadUsers()
  if (users[name]) {
    users[name].remember = remember
    saveUsers(users)
  }
}

export function setCurrentUser(name: string) {
  localStorage.setItem(CURRENT_KEY, name)
}

export function currentUser(): string | null {
  return localStorage.getItem(CURRENT_KEY)
}

export function clearCurrentUser() {
  localStorage.removeItem(CURRENT_KEY)
}

/** 是否存在可自动登录的用户（记住我） */
export function autoLoginUser(): string | null {
  const cur = currentUser()
  if (cur) {
    const users = loadUsers()
    if (users[cur]?.remember) return cur
  }
  return null
}

/** 记住的用户列表（多用户切换用） */
export function rememberedUsers(): string[] {
  const users = loadUsers()
  return Object.entries(users)
    .filter(([, r]) => r.remember)
    .map(([n]) => n)
}
