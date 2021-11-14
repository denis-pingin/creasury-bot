import handleGuildMemberAdd from '../src/events/guildMemberAdd';
import handleGuildMemberRemove from '../src/events/guildMemberRemove';
import { getDatabase } from '../src/db';
import { strict as assert } from 'assert';

const stage = 'Newborn Butterflies: Stage 1';
const guildId = '1';

const member = {
  user: {
    id: '1',
    createdAt: 100,
  },
  guild: { id: guildId },
};

const inviter = {
  id: '2',
  createdAt: 200,
};

const fakeMember = {
  user: {
    id: '1',
    createdAt: new Date(),
  },
  guild: { id: guildId },
};

async function runTests() {
  await testRegular();
  await testFake();
  await testRejoin();
  await testNoInviter();
  await testJoinedBeforeStageStart();

  await clearData();

  console.log('Tests finished!');
  process.exit(0);
}

async function testRegular() {
  await clearData();

  // Add member
  await handleGuildMemberAdd(null, member, inviter);

  const database = await getDatabase();
  let data = await database.collection('members').findOne({ id: member.user.id, guildId });
  assert.notEqual(data, null);
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

  await verifyCounters(inviter.id, 1, 1, undefined, undefined, undefined, 1);
  await verifyJoinEvent(member.user.id, inviter.id, false, 1);

  // Remove member
  await handleGuildMemberRemove(null, member);

  data = await database.collection('members').findOne({ id: member.user.id, guildId });
  assert.notEqual(data, null);
  assert.notEqual(data.removeTimestamp, undefined);
  assert.equal(data.removed, true);

  await verifyCounters(inviter.id, 0, 1, 1, undefined, undefined, 0);
  await verifyLeaveEvent(member.user.id, inviter.id);
}

async function testFake() {
  await clearData();

  // Add fake member
  await handleGuildMemberAdd(null, fakeMember, inviter);

  const database = await getDatabase();
  let data = await database.collection('members').findOne({ id: member.user.id, guildId });
  assert.notEqual(data, null);
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

  await verifyCounters(inviter.id, undefined, undefined, undefined, 1, undefined, undefined);
  await verifyJoinEvent(member.user.id, inviter.id, true, null);

  // Remove fake member
  await handleGuildMemberRemove(null, fakeMember);

  data = await database.collection('members').findOne({ id: member.user.id, guildId });
  assert.notEqual(data, null);
  assert.notEqual(data.removeTimestamp, undefined);
  assert.equal(data.removed, true);

  await verifyCounters(inviter.id, undefined, undefined, undefined, 1, 1, undefined);
  await verifyLeaveEvent(member.user.id, inviter.id);
}

async function testRejoin() {
  await clearData();
  // Add member and remove
  await handleGuildMemberAdd(null, member, inviter);
  await handleGuildMemberRemove(null, member);

  // Re-join
  await handleGuildMemberAdd(null, member, inviter);

  const database = await getDatabase();
  let data = await database.collection('members').findOne({ id: member.user.id, guildId });
  assert.equal(data.fake, false);
  assert.notEqual(data.inviteTimestamp, undefined);
  assert.notEqual(data.inviter, undefined);
  assert.equal(data.inviter.id, inviter.id);
  assert.notEqual(data.originalInviteTimestamp, undefined);
  assert.notEqual(data.originalInviter, undefined);
  assert.equal(data.originalInviter.id, inviter.id);
  assert.notEqual(data.user, undefined);
  assert.equal(data.user.id, member.user.id);
  assert.notEqual(data.removeTimestamp, undefined);
  assert.equal(data.removed, false);

  const prevRemoveTimestamp = data.removeTimestamp;

  await verifyCounters(inviter.id, 1, 2, 1, undefined, undefined, 1);
  await verifyJoinEvent(member.user.id, inviter.id, false, 1);

  data = await database.collection('memberCounters').findOne({ id: member.user.id, guildId });
  assert.notEqual(data, null);
  assert.equal(data.global.rejoins, 1);

  // Remove member
  await handleGuildMemberRemove(null, member);

  data = await database.collection('members').findOne({ id: member.user.id, guildId });
  assert.notEqual(data, null);
  assert.notEqual(data.removeTimestamp, prevRemoveTimestamp);
  assert.equal(data.removed, true);

  await verifyCounters(inviter.id, 0, 2, 2, undefined, undefined, 0);
  await verifyLeaveEvent(member.user.id, inviter.id);
}

async function testNoInviter() {
  await clearData();

  // Add member without inviter
  await handleGuildMemberAdd(null, member, undefined);

  const database = await getDatabase();
  let data = await database.collection('members').findOne({ id: member.user.id, guildId });
  assert.notEqual(data, null);
  assert.equal(data.fake, false);
  assert.notEqual(data.inviteTimestamp, undefined);
  assert.equal(data.inviter, null);
  assert.notEqual(data.originalInviteTimestamp, undefined);
  assert.equal(data.originalInviter, null);
  assert.notEqual(data.user, undefined);
  assert.equal(data.user.id, member.user.id);
  assert.equal(data.removeTimestamp, undefined);
  assert.equal(data.removed, undefined);

  data = await database.collection('memberCounters').findOne({ id: 2, guildId });
  assert.equal(data, null);

  await verifyJoinEvent(member.user.id, undefined, false, null);

  // Remove member without inviter
  await handleGuildMemberRemove(null, member);

  data = await database.collection('memberCounters').findOne({ id: 2, guildId });
  assert.equal(data, null);

  await verifyLeaveEvent(member.user.id, undefined);
}

async function testJoinedBeforeStageStart() {
  await clearData();

  // Add member
  await handleGuildMemberAdd(null, member, inviter);

  // Simulate member's originalInviteTimestamp before stage start
  const database = await getDatabase();
  await database.collection('members').findOneAndUpdate({ id: member.user.id, guildId }, { $set: { originalInviteTimestamp: 0 } });

  await verifyJoinEvent(member.user.id, inviter.id, false, 1);

  // Remove member who joined before stage start
  await handleGuildMemberRemove(null, member);

  const data = await database.collection('members').findOne({ id: member.user.id, guildId });
  assert.notEqual(data, null);
  assert.notEqual(data.removeTimestamp, undefined);
  assert.equal(data.removed, true);

  await verifyCounters(inviter.id, 0, 1, 1, undefined, undefined, 1);
  await verifyLeaveEvent(member.user.id, undefined);

  // Re-join during stage
  await handleGuildMemberAdd(null, member, inviter);

  await verifyCounters(inviter.id, 1, 2, 1, undefined, undefined, 1);
  await verifyJoinEvent(member.user.id, inviter.id, false, 1);

  // Leave again
  await handleGuildMemberRemove(null, member);

  await verifyCounters(inviter.id, 0, 2, 2, undefined, undefined, 1);
  await verifyLeaveEvent(member.user.id, undefined);
}

async function verifyCounters(id, totalInvites, regularInvites, regularLeaves, fakeInvites, fakeLeaves, stagePoints) {
  const database = await getDatabase();
  const data = await database.collection('memberCounters').findOne({ id: id, guildId: guildId });
  assert.notEqual(data, null);
  assert.equal(data.global.totalInvites, totalInvites);
  assert.equal(data.global.regularInvites, regularInvites);
  assert.equal(data.global.regularLeaves, regularLeaves);
  assert.equal(data.global.fakeInvites, fakeInvites);
  assert.equal(data.global.fakeLeaves, fakeLeaves);
  assert.equal(data[stage].points, stagePoints);
}

async function verifyJoinEvent(userId, inviterId, fake, stagePoints) {
  const database = await getDatabase();
  const data = await database.collection('events').findOne({ guildId: guildId, type: 'join', 'user.id': userId, 'inviter.id': inviterId }, { sort: { timestamp: -1 }, limit: 1 });
  assert.notEqual(data, null);
  assert.equal(data.fake, fake);
  assert.equal(data.stagePoints, stagePoints);
}

async function verifyLeaveEvent(userId, inviterId) {
  const database = await getDatabase();
  const data = await database.collection('events').findOne({ guildId: guildId, type: 'leave', 'user.id': userId, 'inviter.id': inviterId }, { sort: { timestamp: -1 }, limit: 1 });
  assert.notEqual(data, undefined);
}

async function clearData() {
  const database = await getDatabase();
  await database.collection('members').deleteOne({ id: member.user.id, guildId });
  await database.collection('members').deleteOne({ id: inviter.id, guildId });
  await database.collection('memberCounters').deleteOne({ id: member.user.id, guildId });
  await database.collection('memberCounters').deleteOne({ id: inviter.id, guildId });
}

runTests();

