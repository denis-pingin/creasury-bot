import 'regenerator-runtime/runtime';
import handleGuildMemberAdd from '../src/events/guildMemberAdd';
import handleGuildMemberRemove from '../src/events/guildMemberRemove';
import { strict as assert } from 'assert';
import { MongoClient } from 'mongodb';
import { generateMembers, getMockClient, getMockGuild, loadDataFile } from './test-util';
import * as db from '../src/db';
import { logObject } from '../src/util';

const stage = 'Newborn Butterflies: Stage 1';
const guildId = '1';
const allMembers = generateMembers(3, guildId);
const stages = loadDataFile('data/stages.json');
const events = loadDataFile('data/events-join-leave.json');

const members = [ allMembers[0] ];

const guild = getMockGuild(guildId, members);
const client = getMockClient(guild);

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

    // Add member
    const joinEvent = events[0];
    members.push(allMembers[1]);
    await handleGuildMemberAdd(client, joinEvent);

    const database = await db.getDatabase();
    let data = await database.collection('members').findOne({ id: joinEvent.user.id, guildId });
    assert.notEqual(data, null);
    assert.equal(data.fake, false);
    assert.notEqual(data.inviteTimestamp, undefined);
    assert.notEqual(data.inviter, undefined);
    assert.equal(data.inviter.id, joinEvent.inviter.id);
    assert.notEqual(data.originalInviteTimestamp, undefined);
    assert.notEqual(data.originalInviter, undefined);
    assert.equal(data.originalInviter.id, joinEvent.inviter.id);
    assert.notEqual(data.user, undefined);
    assert.equal(data.user.id, joinEvent.user.id);
    assert.equal(data.removeTimestamp, undefined);
    assert.equal(data.removed, undefined);

    await verifyCounters(joinEvent.inviter.id, 1, 1, undefined, undefined, undefined, 1);
    await verifyJoinEvent(joinEvent.timestamp, 1);

    // Remove member
    const leaveEvent = events[1];
    members.splice(1, 1);
    await handleGuildMemberRemove(client, leaveEvent);

    data = await database.collection('members').findOne({ id: leaveEvent.user.id, guildId });
    logObject('Members:', data);
    expect(data).toBeTruthy();
    expect(data.removeTimestamp).toBeTruthy();
    expect(data.removed).toBeTruthy();

    await verifyCounters(joinEvent.inviter.id, 0, 1, 1, undefined, undefined, 0);
    await verifyLeaveEvent(leaveEvent.timestamp);
  });

  test('fake joins and leaves', async () => {
    // Add fake member
    const joinEvent = events[2];
    members.push(allMembers[2]);
    await handleGuildMemberAdd(client, joinEvent);

    const database = await db.getDatabase();
    let data = await database.collection('members').findOne({ id: joinEvent.user.id, guildId });
    assert.notEqual(data, null);
    assert.equal(data.id, joinEvent.user.id);
    assert.equal(data.guildId, joinEvent.guildId);
    assert.equal(data.fake, true);
    assert.notEqual(data.inviteTimestamp, undefined);
    assert.notEqual(data.inviter, undefined);
    assert.equal(data.inviter.id, joinEvent.inviter.id);
    assert.notEqual(data.originalInviteTimestamp, undefined);
    assert.notEqual(data.originalInviter, undefined);
    assert.equal(data.originalInviter.id, joinEvent.inviter.id);
    assert.notEqual(data.user, undefined);
    assert.equal(data.user.id, joinEvent.user.id);
    assert.equal(data.removeTimestamp, undefined);
    assert.equal(data.removed, undefined);

    await verifyCounters(joinEvent.inviter.id, undefined, undefined, undefined, 1, undefined, undefined);
    await verifyJoinEvent(joinEvent.timestamp, null);

    // Remove fake member
    const leaveEvent = events[3];
    members.splice(1, 1);
    await handleGuildMemberRemove(client, leaveEvent);

    data = await database.collection('members').findOne({ id: joinEvent.user.id, guildId });
    expect(data).toBeTruthy();
    expect(data.removeTimestamp).toBeTruthy();
    expect(data.removed).toBeTruthy();

    await verifyCounters(joinEvent.inviter.id, undefined, undefined, undefined, 1, 1, undefined);
    await verifyLeaveEvent(leaveEvent.timestamp);
  });

  test('re-joins and leaves', async () => {
    // Add member and remove
    members.push(allMembers[1]);
    await handleGuildMemberAdd(client, events[0]);
    members.splice(1, 1);
    await handleGuildMemberRemove(client, events[1]);

    // Re-join
    const joinEvent = events[4];
    members.push(allMembers[1]);
    await handleGuildMemberAdd(client, joinEvent);

    const database = await db.getDatabase();
    let data = await database.collection('members').findOne({ id: joinEvent.user.id, guildId });
    assert.equal(data.fake, false);
    assert.notEqual(data.inviteTimestamp, undefined);
    assert.notEqual(data.inviter, undefined);
    assert.equal(data.inviter.id, joinEvent.inviter.id);
    assert.notEqual(data.originalInviteTimestamp, undefined);
    assert.notEqual(data.originalInviter, undefined);
    assert.equal(data.originalInviter.id, joinEvent.inviter.id);
    assert.notEqual(data.user, undefined);
    assert.equal(data.user.id, joinEvent.user.id);
    assert.notEqual(data.removeTimestamp, undefined);
    assert.equal(data.removed, false);

    const prevRemoveTimestamp = data.removeTimestamp;

    await verifyCounters(joinEvent.inviter.id, 1, 2, 1, undefined, undefined, 1);
    await verifyJoinEvent(joinEvent.timestamp, 1);

    data = await database.collection('memberCounters').findOne({ id: joinEvent.user.id, guildId });
    assert.notEqual(data, null);
    assert.equal(data.global.rejoins, 1);

    // Remove member
    const leaveEvent = events[5];
    members.splice(1, 1);
    await handleGuildMemberRemove(client, leaveEvent);

    data = await database.collection('members').findOne({ id: joinEvent.user.id, guildId });
    assert.notEqual(data, null);
    assert.notEqual(data.removeTimestamp, prevRemoveTimestamp);
    assert.equal(data.removed, true);

    await verifyCounters(joinEvent.inviter.id, 0, 2, 2, undefined, undefined, 0);
    await verifyLeaveEvent(leaveEvent.timestamp);
  });

  test('no inviter joins and leaves', async () => {
    // Add member without inviter
    const joinEvent = events[6];
    members.push(allMembers[0]);
    await handleGuildMemberAdd(client, joinEvent);

    const database = await db.getDatabase();
    let data = await database.collection('members').findOne({ id: joinEvent.user.id, guildId });
    assert.notEqual(data, null);
    assert.equal(data.fake, false);
    assert.notEqual(data.inviteTimestamp, undefined);
    assert.equal(data.inviter, null);
    assert.notEqual(data.originalInviteTimestamp, undefined);
    assert.equal(data.originalInviter, null);
    assert.notEqual(data.user, undefined);
    assert.equal(data.user.id, joinEvent.user.id);
    assert.equal(data.removeTimestamp, undefined);
    assert.equal(data.removed, undefined);

    data = await database.collection('memberCounters').findOne({ id: 2, guildId });
    assert.equal(data, null);

    await verifyJoinEvent(joinEvent.timestamp, null);

    // Remove member without inviter
    const leaveEvent = events[7];
    members.splice(1, 1);
    await handleGuildMemberRemove(client, leaveEvent);

    data = await database.collection('memberCounters').findOne({ id: 2, guildId });
    assert.equal(data, null);
  });

  test('joined before test start', async () => {
    // Add member
    let joinEvent = events[0];
    members.push(allMembers[0]);
    await handleGuildMemberAdd(client, joinEvent);

    // Simulate member's originalInviteTimestamp before stage start
    const database = await db.getDatabase();
    await database.collection('members').findOneAndUpdate({ id: joinEvent.user.id, guildId }, { $set: { originalInviteTimestamp: 0 } });

    await verifyJoinEvent(joinEvent.timestamp, 1);

    // Remove member who joined before stage start
    let leaveEvent = events[1];
    members.splice(1, 1);
    await handleGuildMemberRemove(client, leaveEvent);

    const data = await database.collection('members').findOne({ id: joinEvent.user.id, guildId });
    assert.notEqual(data, null);
    assert.notEqual(data.removeTimestamp, undefined);
    assert.equal(data.removed, true);

    await verifyCounters(joinEvent.inviter.id, 0, 1, 1, undefined, undefined, 1);

    // Re-join during stage
    joinEvent = events[4];
    members.push(allMembers[0]);
    await handleGuildMemberAdd(client, joinEvent);

    await verifyCounters(joinEvent.inviter.id, 1, 2, 1, undefined, undefined, 1);
    await verifyJoinEvent(joinEvent.timestamp, 1);

    // Leave again
    leaveEvent = events[5];
    members.splice(1, 1);
    await handleGuildMemberRemove(client, leaveEvent);

    await verifyCounters(joinEvent.inviter.id, 0, 2, 2, undefined, undefined, 1);
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

async function verifyJoinEvent(timestamp, stagePoints) {
  const database = await db.getDatabase();
  const data = await database.collection('events').findOne({ timestamp });
  expect(data).toBeTruthy();
  expect(data.processed).toBeTruthy();
  expect(data.stagePoints).toBe(stagePoints);
}

async function verifyLeaveEvent(timestamp) {
  const database = await db.getDatabase();
  const data = await database.collection('events').findOne({ timestamp });
  expect(data).toBeTruthy();
  expect(data.processed).toBeTruthy();
}