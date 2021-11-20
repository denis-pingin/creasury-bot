import fs from 'fs';

export function generateMembers(count, guildId) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push({ user: { id: `${i}`, createdAt: 100 }, guild: { id: guildId, members: { fetch: () => result } } });
  }
  return result;
}

export function generateMembersWithRandomAccountAge(count, guildId) {
  const result = [];
  for (let i = 0; i < count; i++) {
    // Fake with 20% probability
    let createdAt = 100;
    if (Math.random() > 0.8) {
      createdAt = Date.now();
    }
    result.push({ user: { id: `${i}`, createdAt }, guild: { id: guildId, members: { fetch: () => result } } });
  }
  return result;
}

export function loadDataFile(path) {
  return JSON.parse(fs.readFileSync(`${__dirname}/${path}`));
}

export function pause(ms) {
  return new Promise(res => setTimeout(res, ms));
}
