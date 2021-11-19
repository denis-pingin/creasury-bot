'use strict';
import 'regenerator-runtime/runtime';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import {
  distributeGuaranteedReward, distributeLevelRewards, distributeLotteryReward,
} from '../src/distribution';
import * as db from '../src/db';

const stageId = 'Newborn Butterflies: Stage 1';
const guildId = '1';
const stages = JSON.parse(fs.readFileSync(`${__dirname}/data/stages.json`));
const rankings = JSON.parse(fs.readFileSync(`${__dirname}/data/rankings.json`));

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
    const winners = await distributeGuaranteedReward(candidates, reward, guildId);
    expect(winners).toBeTruthy();
    expect(winners.length).toBe(candidates.length);
    for (const i in winners) {
      const memberRewards = await db.getMemberRewards(winners[i], guildId);
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

    const winners = await distributeLotteryReward(candidates, reward, guildId, true);
    expect(reward.supply).toBe(0);
    console.log(winners);
    expect(winners).toBeTruthy();
    expect(winners.length).toBe(2);
    expect(winners[0]).toBe('9');
    expect(winners[1]).toBe('10');
    for (const i in winners) {
      // Validate member rewards
      const memberRewards = await db.getMemberRewards(winners[i], guildId);
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

    const winners = await distributeLotteryReward(candidates, reward, guildId, false);
    expect(reward.supply).toBe(0);
    console.log(winners);
    expect(winners).toBeTruthy();
    expect(winners.length).toBe(2);
    for (const i in winners) {
      const memberRewards = await db.getMemberRewards(winners[i], guildId);
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
    const result = await distributeLevelRewards(stage, rankings, level, guildId);
    expect(result).toBeTruthy();
    expect(result.distributed.length).toBe(3);
    expect(result.unclaimed.length).toBe(0);

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
    expect(stage.rewards.distributed[level]).toStrictEqual(result.distributed);
  });

  test('distribute reward level 3', async () => {
    let stage = await db.getStageById(stageId, guildId);
    const level = 3;
    const result = await distributeLevelRewards(stage, rankings, level, guildId);
    expect(result).toBeTruthy();
    expect(result.distributed.length).toBe(3);
    expect(result.unclaimed.length).toBe(0);

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
    expect(stage.rewards.distributed[level]).toStrictEqual(result.distributed);
  });

  test('distribute reward level 2', async () => {
    let stage = await db.getStageById(stageId, guildId);
    jest.spyOn(global.Math, 'random')
      .mockReturnValue(0.3);
    const level = 2;
    const result = await distributeLevelRewards(stage, rankings, level, guildId);
    expect(result).toBeTruthy();
    expect(result.distributed.length).toBe(3);
    expect(result.unclaimed.length).toBe(1);

    stage = await db.getStageById(stage.id, guildId);
    expect(stage).toBeTruthy();
    expect(stage.rewards.pending[level]).toStrictEqual([]);
    expect(stage.rewards.distributed[level]).toBeTruthy();
    expect(stage.rewards.distributed[level].length).toBe(3);
    expect(stage.rewards.unclaimed[level].length).toBe(1);

    console.log(stage.rewards.distributed[level], stage.rewards.unclaimed[level]);

    expect(stage.rewards.distributed[level][0].winners).toBeTruthy();
    expect(stage.rewards.distributed[level][0].winners.length).toBe(2);
    expect(stage.rewards.distributed[level][0].winners[0]).toBe('1');
    expect(stage.rewards.distributed[level][0].winners[1]).toBe('4');

    expect(stage.rewards.distributed[level][1].winners).toBeTruthy();
    expect(stage.rewards.distributed[level][1].winners.length).toBe(1);
    expect(stage.rewards.distributed[level][1].winners[0]).toBe('1');

    expect(stage.rewards.distributed[level][2].winners).toBeTruthy();
    expect(stage.rewards.distributed[level][2].winners.length).toBe(1);
    expect(stage.rewards.distributed[level][2].winners[0]).toBe('4');

    expect(stage.rewards.distributed[level]).toStrictEqual(result.distributed);

    expect(stage.rewards.unclaimed[level][0].id).toBe('Early Presale Whitelist Spot');
    expect(stage.rewards.unclaimed[level][0].supply).toBe(1);
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
    console.log(stage);

    jest.spyOn(global.Math, 'random')
      .mockReturnValue(0.3);

    const level = 1;
    const result = await distributeLevelRewards(stage, rankings, level, guildId);
    expect(result).toBeTruthy();

    stage = await db.getStageById(stage.id, guildId);
    expect(stage).toBeTruthy();
    expect(stage.rewards.pending[level]).toStrictEqual([]);
    expect(stage.rewards.distributed[level]).toBeTruthy();
    expect(stage.rewards.distributed[level].length).toBe(3);

    console.log(stage.rewards.distributed[level]);

    expect(stage.rewards.distributed[level][0].winners).toStrictEqual(['5', '7', '8', '9', '10', '11', '6', '12']);
    expect(stage.rewards.distributed[level][1].winners).toStrictEqual([ '8' ]);
    expect(stage.rewards.distributed[level][2].winners).toStrictEqual([ '9', '7', '10', '11', '5' ]);

    expect(stage.rewards.distributed[level]).toStrictEqual(result.distributed);
  });
});