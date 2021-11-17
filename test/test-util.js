import { getDatabase } from '../src/db';

export async function clearData() {
  const database = await getDatabase();
  await database.collection('events').deleteMany({});
  await database.collection('members').deleteMany({});
  await database.collection('memberCounters').deleteMany({});
  await database.collection('stages').deleteMany({});
  await database.collection('stageRankings').deleteMany({});
  await database.collection('config').deleteMany({});
}

export function generateMembers(count, guildId) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push({ user: { id: `${i}`, createdAt: 100 }, guild: { id: guildId, members: { fetch: () => result } } });
  }
  return result;
}
