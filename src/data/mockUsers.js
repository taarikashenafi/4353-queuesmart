export const mockUsers = [
  { email: 'user@queuesmart.com', password: 'password123', role: 'user' },
  { email: 'admin@queuesmart.com', password: 'admin12345', role: 'admin' },
]

export function findUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase()

  return mockUsers.find(
    (user) => user.email.toLowerCase() === normalizedEmail && user.password === password,
  ) ?? null
}

export function emailTaken(email) {
  const normalizedEmail = email.trim().toLowerCase()

  return mockUsers.some((user) => user.email.toLowerCase() === normalizedEmail)
}