'use strict';
import 'regenerator-runtime/runtime';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import {
  distributeGuaranteedReward, distributeLevelRewards, distributeLotteryReward,
} from '../src/distribution';
import * as db from '../src/db';
import { logObject } from '../src/util';
import { loadDataFile } from './test-util';

const stageId = 'Newborn Butterflies: Stage 1';
const guildId = '1';
const stages = loadDataFile('data/stages.json');
const rankings = loadDataFile('data/rankings.json');

describe('reward', () => {
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
  });

  afterEach(() => {
    jest.spyOn(global.Math, 'random').mockRestore();
  });

  test('distribute guaranteed reward', async () => {
    const reward = {
      type: 'achievements',
      id: 'Pioneer Rookie I',
      distribution: 'guaranteed',
    };
    const candidates = rankings.rankings.filter(rank => rank.level === 1);
    const results = await distributeGuaranteedReward(candidates, reward, guildId);
    logObject('Results:', results);
    expect(results).toBeTruthy();
    expect(results.length).toBe(candidates.length);
    for (const i in results) {
      const memberRewards = await db.getMemberRewards(results[i].winner, guildId);
      expect(memberRewards).toBeTruthy();
      expect(memberRewards[reward.type]).toBeTruthy();
      expect(memberRewards[reward.type].length).toBe(1);
      expect(memberRewards[reward.type][0].id).toBe(reward.id);
      expect(memberRewards[reward.type][0].supply).toBeUndefined();
    }
  });

  test('distribute weighted lottery reward', async () => {
    const reward = {
      type: 'creasuryButterflies',
      id: 'Creasury Butterfly',
      distribution: 'weighted-lottery',
      supply: 2,
    };
    const candidates = rankings.rankings.filter(rank => rank.level === 1);
    jest.spyOn(global.Math, 'random')
      .mockReturnValue(0.5);

    const results = await distributeLotteryReward(candidates, reward, guildId, true);
    logObject('Results:', results);
    expect(reward.supply).toBe(0);
    expect(results).toBeTruthy();
    expect(results.length).toBe(2);
    expect(results[0].winner).toBe('9');
    expect(results[0].participantCount).toBe(8);
    expect(results[0].ticketCount).toBe(15);
    expect(results[0].winningTicket).toBe(7);
    expect(results[1].winner).toBe('10');
    expect(results[1].participantCount).toBe(7);
    expect(results[1].ticketCount).toBe(13);
    expect(results[1].winningTicket).toBe(6);
    for (const i in results) {
      // Validate member rewards
      const memberRewards = await db.getMemberRewards(results[i].winner, guildId);
      console.log(memberRewards);
      expect(memberRewards).toBeTruthy();
      expect(memberRewards[reward.type]).toBeTruthy();
      expect(memberRewards[reward.type].length).toBe(1);
      expect(memberRewards[reward.type][0].id).toBe(reward.id);
      expect(memberRewards[reward.type][0].supply).toBeUndefined();
    }
  });

  test('distribute simple lottery reward', async () => {
    const reward = {
      type: 'creasuryButterflies',
      id: 'Creasury Butterfly',
      distribution: 'simple-lottery',
      supply: 2,
    };
    const candidates = rankings.rankings.filter(rank => rank.level === 1);
    jest.spyOn(global.Math, 'random')
      .mockReturnValue(0.5);

    const results = await distributeLotteryReward(candidates, reward, guildId, false);
    logObject('Results:', results);
    expect(reward.supply).toBe(0);
    expect(results).toBeTruthy();
    expect(results.length).toBe(2);
    expect(results[0].winner).toBe('10');
    expect(results[0].participantCount).toBe(8);
    expect(results[0].ticketCount).toBe(8);
    expect(results[0].winningTicket).toBe(4);
    expect(results[1].winner).toBe('9');
    expect(results[1].participantCount).toBe(7);
    expect(results[1].ticketCount).toBe(7);
    expect(results[1].winningTicket).toBe(3);
    for (const i in results) {
      const memberRewards = await db.getMemberRewards(results[i].winner, guildId);
      expect(memberRewards).toBeTruthy();
      expect(memberRewards[reward.type]).toBeTruthy();
      expect(memberRewards[reward.type].length).toBe(1);
      expect(memberRewards[reward.type][0].id).toBe(reward.id);
      expect(memberRewards[reward.type][0].supply).toBeUndefined();
    }
  });

  test('distribute reward level 5', async () => {
    let stage = await db.getStageById(stageId, guildId);
    const level = 5;
    const result = await distributeLevelRewards(stage, rankings, level, guildId);
    logObject('Results:', result);
    expect(result).toBeTruthy();
    expect(result.distributed.length).toBe(3);
    expect(result.unclaimed.length).toBe(0);

    stage = await db.getStageById(stage.id, guildId);
    expect(stage).toBeTruthy();
    expect(stage.rewards.pending[level]).toStrictEqual([]);
    expect(stage.rewards.unclaimed).toBeFalsy();
    expect(stage.rewards.distributed[level]).toBeTruthy();
    expect(stage.rewards.distributed[level].length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(stage.rewards.distributed[level][i].winners).toBeTruthy();
      expect(stage.rewards.distributed[level][i].winners.length).toBe(1);
      expect(stage.rewards.distributed[level][i].winners[0]).toBe('2');
    }
    expect(stage.rewards.distributed[level]).toStrictEqual(result.distributed);
  });

  test('distribute reward level 4', async () => {
    let stage = await db.getStageById(stageId, guildId);
    const level = 4;
    const results = await distributeLevelRewards(stage, rankings, level, guildId);
    logObject('Results:', results);
    expect(results).toBeTruthy();
    expect(results.distributed.length).toBe(3);
    expect(results.unclaimed.length).toBe(0);

    stage = await db.getStageById(stage.id, guildId);
    expect(stage.rewards.pending[level]).toStrictEqual([]);
    expect(stage.rewards.unclaimed).toBeFalsy();
    expect(stage.rewards.distributed[level]).toBeTruthy();
    expect(stage.rewards.distributed[level].length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(stage.rewards.distributed[level][i].winners).toBeTruthy();
      expect(stage.rewards.distributed[level][i].winners.length).toBe(1);
      expect(stage.rewards.distributed[level][i].winners[0]).toBe('3');
    }
    expect(stage.rewards.distributed[level]).toStrictEqual(results.distributed);
  });

  test('distribute reward level 3', async () => {
    let stage = await db.getStageById(stageId, guildId);
    const level = 3;
    const results = await distributeLevelRewards(stage, rankings, level, guildId);
    logObject('Results:', results);
    expect(results).toBeTruthy();
    expect(results.distributed.length).toBe(3);
    expect(results.unclaimed.length).toBe(0);

    stage = await db.getStageById(stage.id, guildId);
    expect(stage.rewards.pending[level]).toStrictEqual([]);
    expect(stage.rewards.unclaimed).toBeFalsy();
    expect(stage.rewards.distributed[level]).toBeTruthy();
    expect(stage.rewards.distributed[level].length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(stage.rewards.distributed[level][i].winners).toBeTruthy();
      expect(stage.rewards.distributed[level][i].winners.length).toBe(1);
      expect(stage.rewards.distributed[level][i].winners[0]).toBe('0');
    }
    expect(stage.rewards.distributed[level]).toStrictEqual(results.distributed);
  });

  test('distribute reward level 2', async () => {
    let stage = await db.getStageById(stageId, guildId);
    jest.spyOn(global.Math, 'random')
      .mockReturnValue(0.3);
    const level = 2;
    const results = await distributeLevelRewards(stage, rankings, level, guildId);
    logObject('Results:', results);

    const expectedResults = loadDataFile('data/distribution-level-2.json');
    expect(results).toStrictEqual(expectedResults);

    stage = await db.getStageById(stage.id, guildId);
    expect(stage).toBeTruthy();
    expect(stage.rewards.pending[level]).toStrictEqual([]);
    expect(stage.rewards.distributed[level]).toStrictEqual(expectedResults.distributed);
    expect(stage.rewards.unclaimed[level]).toStrictEqual(expectedResults.unclaimed);
  });

  test('fail to distribute reward for level 1 if level 2 not distributed', async () => {
    const stage = await db.getStageById(stageId, guildId);
    const level = 1;
    await expect(distributeLevelRewards(stage, rankings, level, guildId))
      .rejects
      .toThrow('Trying to distribute rewards for level 1, but rewards for level 2 have not yet been distributed.');
  });

  test('distribute reward level 1', async () => {
    let stage = await db.getStageById(stageId, guildId);

    // First need to distribute level 2 rewards
    await distributeLevelRewards(stage, rankings, 2, guildId);
    stage = await db.getStageById(stageId, guildId);

    jest.spyOn(global.Math, 'random')
      .mockReturnValue(0.3);

    const level = 1;
    const results = await distributeLevelRewards(stage, rankings, level, guildId);
    logObject('Results:', results);
    expect(results).toBeTruthy();

    const expectedResults = loadDataFile('data/distribution-level-1.json');
    expect(results).toStrictEqual(expectedResults);

    stage = await db.getStageById(stage.id, guildId);
    expect(stage).toBeTruthy();
    expect(stage.rewards.pending[level]).toStrictEqual([]);
    expect(stage.rewards.distributed[level]).toStrictEqual(expectedResults.distributed);
    expect(stage.rewards.unclaimed[level]).toBeFalsy();
  });
});