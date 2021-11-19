export function generateMembers(count, guildId) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push({ user: { id: `${i}`, createdAt: 100 }, guild: { id: guildId, members: { fetch: () => result } } });
  }
  return result;
}
