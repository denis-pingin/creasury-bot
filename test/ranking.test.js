import 'regenerator-runtime/runtime';
import { generateMembers, getMockClient, getMockGuild, loadDataFile } from './test-util';
import { MongoClient } from 'mongodb';
import * as db from '../src/db';
import {
  computeRankings,
  getL2CutoffIndex,
  getMemberRanking,
  getNextLevelPointsDiff,
  getScoreboard,
} from '../src/ranking';
import handleGuildMemberAdd from '../src/events/guildMemberAdd';
import * as assert from 'assert';
import handleGuildMemberRemove from '../src/events/guildMemberRemove';

const stageId = 'Newborn Butterflies: Stage 1';
const guildId = '1';
const allMembers = generateMembers(32, guildId);
const stages = loadDataFile('data/stages.json');
const rankings = loadDataFile('data/rankings.json');
const config = loadDataFile('data/config.json');
const members = [allMembers[0]];
const memberMap = {};
const guild = getMockGuild(guildId, members);
const client = getMockClient(guild);

describe('compute rankings', () => {
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
    await database.collection('stageRankings').insertOne(rankings);
    await database.collection('config').insertOne(config);
  });

  test('member rank', async () => {
    let rank = await getMemberRanking(allMembers[0].user.id, stageId, guildId);
    verifyMemberRank(rank, 3, 3, 3);

    rank = await getMemberRanking(allMembers[1].user.id, stageId, guildId);
    verifyMemberRank(rank, 4, 3, 2);

    rank = await getMemberRanking(allMembers[2].user.id, stageId, guildId);
    verifyMemberRank(rank, 1, 3, 5);
  });

  test('compute rank', async () => {

    // Generate data
    await processEvents();
    // const database = await db.getDatabase();
    // logObject('Events:', await database.collection('events').find({}).toArray());

    // Compute rankings
    const stage = stages.find(element => element.id === stageId);
    await computeRankings(allMembers, stage, guildId);

    // Verify rankings
    let result = await db.getStageRankings(stageId, guildId);
    // logObject('Rankings:', result);
    // fs.writeFileSync(`${__dirname}/data/rankings1.json`, JSON.stringify(result, null, 2));
    assert.notEqual(result, null);
    result = result.rankings.reduce((prev, cur) => {
      prev[cur.id] = cur;
      return prev;
    }, {});
    verifyTableRank(result, 2, 1, 3, 5);
    verifyTableRank(result, 3, 2, 3, 4);
    verifyTableRank(result, 0, 3, 3, 3);
    verifyTableRank(result, 1, 4, 3, 2);
    verifyTableRank(result, 4, 5, 2, 2);
    verifyTableRank(result, 5, 6, 2, 2);
    verifyTableRank(result, 7, 7, 2, 1);
    verifyTableRank(result, 8, 8, 2, 1);
    verifyTableRank(result, 9, 9, 2, 1);
    verifyTableRank(result, 10, 10, 2, 1);
    verifyTableRank(result, 11, 11, 2, 1);
    verifyTableRank(result, 6, 12, 2, 1);
    verifyTableRank(result, 12, 13, 1, 1);
    for (let i = 13; i < 32; i++) {
      verifyTableRank(result, i, i + 1, 0, null);
    }
  });

  test('scoreboard', async () => {
    const scoreboard = await getScoreboard(stages.find(stage => stage.id === stageId), allMembers[0].user.id, guildId);
    assert.notEqual(scoreboard, null);
  });

  test('next level points with no level', async () => {
    expect(getNextLevelPointsDiff(undefined, 0, rankings, stages[0])).toBe(1);
  });

  test('next level points with level 1', async () => {
    expect(getNextLevelPointsDiff(1, 1, rankings, stages[0])).toBe(2);
    expect(getNextLevelPointsDiff(1, 2, rankings, stages[0])).toBe(1);
  });

  test('next level points with level 2', async () => {
    expect(getNextLevelPointsDiff(2, 2, rankings, stages[0])).toBe(2);
    expect(getNextLevelPointsDiff(2, 3, rankings, stages[0])).toBe(1);
  });

  test('next level points with level 3', async () => {
    expect(getNextLevelPointsDiff(3, 2, rankings, stages[0])).toBe(2);
    expect(getNextLevelPointsDiff(3, 3, rankings, stages[0])).toBe(1);
  });

  test('next level points with level 4', async () => {
    expect(getNextLevelPointsDiff(4, 3, rankings, stages[0])).toBe(1);
  });

  test('next level points with level 5', async () => {
    expect(getNextLevelPointsDiff(5, 5, rankings, stages[0])).toBeFalsy();
  });

  test('next level points no master', async () => {
    const r = loadDataFile('data/rankings-no-master.json');
    expect(getNextLevelPointsDiff(1, 7, r, stages[0])).toBe(2);
  });

  test('next level points one master', async () => {
    const r = loadDataFile('data/rankings-one-master.json');
    expect(getNextLevelPointsDiff(1, 6, r, stages[0])).toBe(2);
  });

  test('cutoff index no l2', async () => {
    const r = loadDataFile('data/rankings-no-l2.json');
    expect(getL2CutoffIndex(r.rankings, stages[0])).toBe(2);
  });

  test('cutoff index one l2', async () => {
    const r = loadDataFile('data/rankings-one-l2.json');
    expect(getL2CutoffIndex(r.rankings, stages[0])).toBe(3);
  });

  test('cutoff index one l2 many l1', async () => {
    const r = loadDataFile('data/rankings-one-l2-many-l1.json');
    expect(getL2CutoffIndex(r.rankings, stages[0])).toBe(3);
  });
});

function verifyTableRank(table, userId, position, points, level) {
  assert.notEqual(table[userId], null);
  assert.equal(table[userId].points, points);
  assert.equal(table[userId].level, level);
  assert.equal(table[userId].position, position);
}

function verifyMemberRank(rank, position, points, level) {
  assert.notEqual(rank, null);
  assert.equal(rank.points, points);
  assert.equal(rank.level, level);
  assert.equal(rank.position, position);
}

async function processEvents() {
  await addMember(1, 0);
  await addMember(2, 0);
  await addMember(3, 0);

  await addMember(4, 1);
  await addMember(5, 1);
  await addMember(6, 1);

  await addMember(7, 2);
  await addMember(8, 2);
  await addMember(9, 2);

  await addMember(10, 3);
  await addMember(11, 3);
  await addMember(12, 3);

  await addMember(13, 4);
  await addMember(14, 4);

  await addMember(15, 5);
  await addMember(16, 5);

  await addMember(17, 6);
  await addMember(18, 6);

  await addMember(19, 7);
  await addMember(21, 7);

  await addMember(22, 8);
  await addMember(23, 8);

  await addMember(24, 9);
  await addMember(25, 9);

  await addMember(26, 10);
  await addMember(27, 10);

  await addMember(28, 11);
  await addMember(29, 11);

  await addMember(30, 12);

  // Re-join invited by member 0
  await removeMember(1);
  await addMember(1, 0);

  // Re-join originally invited by member 1, now by member 9
  await removeMember(5);
  await addMember(5, 9);

  // Invited by member 5
  await addMember(31, 5);
  await removeMember(31);

  // Invited by member 6
  await removeMember(18);
  await addMember(18, 5);
}

async function addMember(memberIndex, inviterIndex) {
  const member = allMembers[memberIndex];
  const inviter = allMembers[inviterIndex];
  memberMap[memberIndex] = member;
  members.splice(0, members.length);
  members.concat(Object.values(memberMap));
  await handleGuildMemberAdd(client, getJoinEvent(member.user.id, inviter.user.id));
}

async function removeMember(memberIndex) {
  const member = allMembers[memberIndex];
  console.log(`Removing ${memberIndex}:`, member);
  delete memberMap[memberIndex];
  members.splice(0, members.length);
  members.concat(Object.values(memberMap));
  await handleGuildMemberRemove(client, getLeaveEvent(member.user.id));
}

function getJoinEvent(userId, inviterId) {
  return {
    type: 'join',
    guildId: guildId,
    user: {
      id: userId,
    },
    createdAt: 100,
    inviter: {
      id: inviterId,
    },
    fake: false,
    timestamp: Date.now(),
  };
}

function getLeaveEvent(userId) {
  return {
    type: 'leave',
    guildId: guildId,
    user: {
      id: userId,
    },
    timestamp: Date.now(),
  };
}