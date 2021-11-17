import 'regenerator-runtime/runtime';
import { getDatabase, setConnection } from '../src/db';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import { computeRankings, getLeaderboard, getMemberRanking } from '../src/ranking';
import { strict as assert } from 'assert';
import { clearData, generateMembers } from './test-util';
import handleGuildMemberAdd from '../src/events/guildMemberAdd';
import handleGuildMemberRemove from '../src/events/guildMemberRemove';
import * as db from '../src/db';

const stageId = 'Newborn Butterflies: Stage 1';
const guildId = '1';
const members = generateMembers(32, guildId);
const stages = JSON.parse(fs.readFileSync(`${__dirname}/data/stages.json`));
const rankings = JSON.parse(fs.readFileSync(`${__dirname}/data/rankings.json`));

describe('compute rankings', () => {
  let connection;

  beforeAll(async () => {
    connection = await MongoClient.connect(global.__MONGO_URI__, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    setConnection(connection);
  });

  beforeEach(async () => {
    await clearData();
    const database = await getDatabase();
    await database.collection('stages').insertMany(stages);
    await database.collection('stageRankings').insertOne(rankings);
  });

  test('member rank', async () => {
    let rank = await getMemberRanking(members[0].user.id, stageId, guildId);
    verifyMemberRank(rank, 3, 3, 3);

    rank = await getMemberRanking(members[1].user.id, stageId, guildId);
    verifyMemberRank(rank, 4, 3, 2);

    rank = await getMemberRanking(members[2].user.id, stageId, guildId);
    verifyMemberRank(rank, 1, 3, 5);
  });

  test('compute rank', async () => {

    {
      await handleGuildMemberAdd(null, members[1], members[0].user);
      await handleGuildMemberAdd(null, members[2], members[0].user);
      await handleGuildMemberAdd(null, members[3], members[0].user);

      await handleGuildMemberAdd(null, members[4], members[1].user);
      await handleGuildMemberAdd(null, members[5], members[1].user);
      await handleGuildMemberAdd(null, members[6], members[1].user);

      await handleGuildMemberAdd(null, members[7], members[2].user);
      await handleGuildMemberAdd(null, members[8], members[2].user);
      await handleGuildMemberAdd(null, members[9], members[2].user);

      await handleGuildMemberAdd(null, members[10], members[3].user);
      await handleGuildMemberAdd(null, members[11], members[3].user);
      await handleGuildMemberAdd(null, members[12], members[3].user);

      await handleGuildMemberAdd(null, members[13], members[4].user);
      await handleGuildMemberAdd(null, members[14], members[4].user);

      await handleGuildMemberAdd(null, members[15], members[5].user);
      await handleGuildMemberAdd(null, members[16], members[5].user);

      await handleGuildMemberAdd(null, members[17], members[6].user);
      await handleGuildMemberAdd(null, members[18], members[6].user);

      await handleGuildMemberAdd(null, members[19], members[7].user);
      await handleGuildMemberAdd(null, members[21], members[7].user);

      await handleGuildMemberAdd(null, members[22], members[8].user);
      await handleGuildMemberAdd(null, members[23], members[8].user);

      await handleGuildMemberAdd(null, members[24], members[9].user);
      await handleGuildMemberAdd(null, members[25], members[9].user);

      await handleGuildMemberAdd(null, members[26], members[10].user);
      await handleGuildMemberAdd(null, members[27], members[10].user);

      await handleGuildMemberAdd(null, members[28], members[11].user);
      await handleGuildMemberAdd(null, members[29], members[11].user);

      await handleGuildMemberAdd(null, members[30], members[12].user);

      // Re-join invited by member 0
      await handleGuildMemberRemove(null, members[1]);
      await handleGuildMemberAdd(null, members[1], members[0].user);

      // Re-join originally invited by member 1, now by member 9
      await handleGuildMemberRemove(null, members[5]);
      await handleGuildMemberAdd(null, members[5], members[9].user);

      // Invited by member 5
      await handleGuildMemberAdd(null, members[31], members[5].user);
      await handleGuildMemberRemove(null, members[31]);

      // Invited by member 6
      await handleGuildMemberRemove(null, members[18]);
      await handleGuildMemberAdd(null, members[18], members[5].user);
    }

    const stage = stages.find(element => element.id === stageId);
    await computeRankings(members, stage, guildId);


    let result = await db.getStageRankings(stageId, guildId);
    fs.writeFileSync(`${__dirname}/data/rankings.json`, JSON.stringify(result, null, 2));
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
    verifyTableRank(result, 5, 6, 2, 1);
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

  test('leaderboard', async () => {
    const leaderboard = await getLeaderboard(stages.find(stage => stage.id === stageId), members[0].user.id, guildId);
    assert.notEqual(leaderboard, null);
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