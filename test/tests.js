import handleGuildMemberAdd from '../src/events/guildMemberAdd';
import handleGuildMemberRemove from '../src/events/guildMemberRemove';
import { getDatabase } from '../src/db';
import { strict as assert } from 'assert';

const stage = 'Newborn Butterflies: Stage 1';

const member = {
  user: {
    id: 1,
    createdAt: 100,
  },
  guild: { id: 1 },
};

const inviter = {
  id: 2,
  createdAt: 200,
};

const fakeMember = {
  user: {
    id: 1,
    createdAt: new Date(),
  },
  guild: { id: 1 },
};

async function clearData() {
  const database = await getDatabase();
  await database.collection('members').deleteOne({ id: 1, guildId: 1 });
  await database.collection('members').deleteOne({ id: 2, guildId: 1 });
  await database.collection('memberCounters').deleteOne({ id: 1, guildId: 1 });
  await database.collection('memberCounters').deleteOne({ id: 2, guildId: 1 });
}

async function testRegularAddRemove() {
  await clearData();

  await handleGuildMemberAdd(null, member, inviter);

  const database = await getDatabase();
  let data = await database.collection('members').findOne({ id: 1, guildId: 1 });
  assert.equal(data.fake, false);
  assert.notEqual(data.inviteTimestamp, undefined);
  assert.notEqual(data.inviter, undefined);
  assert.equal(data.inviter.id, inviter.id);
  assert.notEqual(data.originalInviteTimestamp, undefined);
  assert.notEqual(data.originalInviter, undefined);
  assert.equal(data.originalInviter.id, inviter.id);
  assert.notEqual(data.user, undefined);
  assert.equal(data.user.id, member.user.id);
  assert.equal(data.removeTimestamp, undefined);
  assert.equal(data.removed, undefined);

  data = await database.collection('memberCounters').findOne({ id: 2, guildId: 1 });
  assert.equal(data.global.points, 1);
  assert.equal(data[stage].points, 1);

  await handleGuildMemberRemove(null, member);

  data = await database.collection('members').findOne({ id: 1, guildId: 1 });
  assert.notEqual(data.removeTimestamp, undefined);
  assert.equal(data.removed, true);

  data = await database.collection('memberCounters').findOne({ id: 2, guildId: 1 });
  assert.equal(data.global.points, 0);
  assert.equal(data[stage].points, 0);
}

async function testFakeAddRemove() {
  await clearData();

  await handleGuildMemberAdd(null, fakeMember, inviter);

  const database = await getDatabase();
  let data = await database.collection('members').findOne({ id: 1, guildId: 1 });
  assert.equal(data.id, member.user.id);
  assert.equal(data.guildId, member.guild.id);
  assert.equal(data.fake, true);
  assert.notEqual(data.inviteTimestamp, undefined);
  assert.notEqual(data.inviter, undefined);
  assert.equal(data.inviter.id, inviter.id);
  assert.notEqual(data.originalInviteTimestamp, undefined);
  assert.notEqual(data.originalInviter, undefined);
  assert.equal(data.originalInviter.id, inviter.id);
  assert.notEqual(data.user, undefined);
  assert.equal(data.user.id, member.user.id);
  assert.equal(data.removeTimestamp, undefined);
  assert.equal(data.removed, undefined);

  data = await database.collection('memberCounters').findOne({ id: 2, guildId: 1 });
  assert.equal(data.global.points, undefined);
  assert.equal(data[stage].points, undefined);

  await handleGuildMemberRemove(null, fakeMember);

  data = await database.collection('members').findOne({ id: 1, guildId: 1 });
  assert.notEqual(data.removeTimestamp, undefined);
  assert.equal(data.removed, true);

  data = await database.collection('memberCounters').findOne({ id: 2, guildId: 1 });
  assert.equal(data.global.points, undefined);
  assert.equal(data[stage].points, undefined);
}

async function runTests() {
  await testRegularAddRemove();
  await testFakeAddRemove();

  console.log('Tests finished!');
  process.exit(0);
}

runTests();

