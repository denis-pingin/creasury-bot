import 'regenerator-runtime/runtime';
import handleGuildMemberAdd from '../src/events/guildMemberAdd';
import handleGuildMemberRemove from '../src/events/guildMemberRemove';
import { strict as assert } from 'assert';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import { generateMembers } from './test-util';
import * as db from '../src/db';

const stage = 'Newborn Butterflies: Stage 1';
const guildId = '1';
const members = generateMembers(3, guildId);
const stages = JSON.parse(fs.readFileSync(`${__dirname}/data/stages.json`));

// Fake account
members[2].user.createdAt = Date.now();

describe('join and leave events', () => {
  let connection;

  beforeAll(async () => {
    connection = await MongoClient.connect(global.__MONGO_URI__, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db.setConnection(connection);
  });

  beforeEach(async () => {
    await db.clearData();

    const database = await db.getDatabase();
    await database.collection('stages').insertMany(stages);
  });

  test('regular joins and leaves', async () => {
    const member = members[0];
    const inviter = members[1].user;

    // Add member
    await handleGuildMemberAdd(null, member, inviter);

    const database = await db.getDatabase();
    let data = await database.collection('members').findOne({ id:member.user.id, guildId });
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
  });

  test('fake joins and leaves', async () => {
    const fakeMember = members[2];
    const inviter = members[1].user;

    // Add fake member
    await handleGuildMemberAdd(null, fakeMember, inviter);

    const database = await db.getDatabase();
    let data = await database.collection('members').findOne({ id: fakeMember.user.id, guildId });
    assert.notEqual(data, null);
    assert.equal(data.id, fakeMember.user.id);
    assert.equal(data.guildId, fakeMember.guild.id);
    assert.equal(data.fake, true);
    assert.notEqual(data.inviteTimestamp, undefined);
    assert.notEqual(data.inviter, undefined);
    assert.equal(data.inviter.id, inviter.id);
    assert.notEqual(data.originalInviteTimestamp, undefined);
    assert.notEqual(data.originalInviter, undefined);
    assert.equal(data.originalInviter.id, inviter.id);
    assert.notEqual(data.user, undefined);
    assert.equal(data.user.id, fakeMember.user.id);
    assert.equal(data.removeTimestamp, undefined);
    assert.equal(data.removed, undefined);

    await verifyCounters(inviter.id, undefined, undefined, undefined, 1, undefined, undefined);
    await verifyJoinEvent(fakeMember.user.id, inviter.id, true, null);

    // Remove fake member
    await handleGuildMemberRemove(null, fakeMember);

    data = await database.collection('members').findOne({ id: fakeMember.user.id, guildId });
    assert.notEqual(data, null);
    assert.notEqual(data.removeTimestamp, undefined);
    assert.equal(data.removed, true);

    await verifyCounters(inviter.id, undefined, undefined, undefined, 1, 1, undefined);
    await verifyLeaveEvent(fakeMember.user.id, inviter.id);
  });

  test('re-joins and leaves', async () => {
    const member = members[0];
    const inviter = members[1].user;

    // Add member and remove
    await handleGuildMemberAdd(null, member, inviter);
    await handleGuildMemberRemove(null, member);

    // Re-join
    await handleGuildMemberAdd(null, member, inviter);

    const database = await db.getDatabase();
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
  });

  test('no inviter joins and leaves', async () => {
    const member = members[0];

    // Add member without inviter
    await handleGuildMemberAdd(null, member, undefined);

    const database = await db.getDatabase();
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

    await verifyJoinEvent(member.user.id, undefined, false, undefined);

    // Remove member without inviter
    await handleGuildMemberRemove(null, member);

    data = await database.collection('memberCounters').findOne({ id: 2, guildId });
    assert.equal(data, null);

    await verifyLeaveEvent(member.user.id, undefined);
  });

  test('joined before test start', async () => {
    const member = members[0];
    const inviter = members[0].user;

    // Add member
    await handleGuildMemberAdd(null, member, inviter);

    // Simulate member's originalInviteTimestamp before stage start
    const database = await db.getDatabase();
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
  });
});

async function verifyCounters(id, totalInvites, regularInvites, regularLeaves, fakeInvites, fakeLeaves, stagePoints) {
  const database = await db.getDatabase();
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
  const database = await db.getDatabase();
  const data = await database.collection('events').findOne({ guildId: guildId, type: 'join', 'user.id': userId, 'inviter.id': inviterId }, { sort: { timestamp: -1 }, limit: 1 });
  assert.notEqual(data, null);
  assert.equal(data.fake, fake);
  assert.equal(data.stagePoints, stagePoints);
}

async function verifyLeaveEvent(userId, inviterId) {
  const database = await db.getDatabase();
  const data = await database.collection('events').findOne({ guildId: guildId, type: 'leave', 'user.id': userId, 'inviter.id': inviterId }, { sort: { timestamp: -1 }, limit: 1 });
  assert.notEqual(data, undefined);
}