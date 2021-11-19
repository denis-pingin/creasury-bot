import fs from 'fs';

export function generateMembers(count, guildId) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push({ user: { id: `${i}`, createdAt: 100 }, guild: { id: guildId, members: { fetch: () => result } } });
  }
  return result;
}

export function loadDataFile(path) {
  return JSON.parse(fs.readFileSync(`${__dirname}/${path}`));
}