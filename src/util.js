export function getUserTag(user) {
  if (!user) return 'unknown user';
  return `<@${user.id}>`;
}
