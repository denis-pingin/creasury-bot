'use strict';
import 'regenerator-runtime/runtime';
import * as db from '../src/db';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import { strict as assert } from 'assert';
import { endStageTimer, getStageEndTime, startStageTimer, switchStage } from '../src/stage';

const stageId = 'Newborn Butterflies: Stage 1';
const nextStageId = 'Newborn Butterflies: Stage 2';
const guildId = '1';
const stages = JSON.parse(fs.readFileSync(`${__dirname}/data/stages.json`));

const pause = ms => new Promise(res => setTimeout(res, ms));

describe('stage', () => {
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

  test('no previous stage if the first stage is active', async () => {
    const prevStage = await db.getPreviousStage(guildId);
    console.log(prevStage);
    expect(prevStage).toBeFalsy();
  });

  test('get previous stage if the second stage is active', async () => {
    const stage = stages.find(s => s.id === stageId);
    await switchStage(stage);
    const prevStage = await db.getPreviousStage(guildId);
    expect(prevStage).toBeTruthy();
    expect(prevStage.id).toBe(stageId);
  });

  test('get previous stage if all stages have ended', async () => {
    const stage = stages.find(s => s.id === stageId);
    const nextStage = await switchStage(stage);
    await switchStage(nextStage);
    const prevStage = await db.getPreviousStage(guildId);
    expect(prevStage).toBeTruthy();
    expect(prevStage.id).toBe(nextStageId);
  });

  test('stage end time same day', async () => {
    const expected = new Date(Date.UTC(2021, 11, 31, 12, 0, 0));
    const endTime = getStageEndTime(new Date(2021, 11, 31, 11, 59, 59));
    assert.equal(endTime.getTime(), expected.getTime());
  });

  test('stage end time next day', async () => {
    const expected = new Date(Date.UTC(2022, 0, 1, 12, 0, 0));
    const endTime = getStageEndTime(new Date(2021, 11, 31, 12, 0, 0));
    assert.equal(endTime.getTime(), expected.getTime());
  });

  test('switch stage regular', async () => {
    const stage = stages.find(s => s.id === stageId);
    const nextStage = await switchStage(stage);
    assert.notEqual(nextStage, null);
    assert.equal(nextStage.id, nextStageId);
    assert.equal(nextStage.active, true);
    assert.equal(nextStage.started, true);
    assert.notEqual(nextStage.startedAt, undefined);
    assert.notEqual(nextStage.startedAt, null);

    const prevStage = await db.getStageByOrder(0, stage.guildId);
    assert.notEqual(prevStage, null);
    assert.equal(prevStage.id, stageId);
    assert.equal(prevStage.active, false);
    assert.equal(prevStage.ended, true);
    assert.notEqual(prevStage.endedAt, undefined);
    assert.notEqual(prevStage.endedAt, null);
  });

  test('switch last stage', async () => {
    const stage = stages.find(s => s.id === stageId);
    let nextStage = await switchStage(stage);
    nextStage = await switchStage(nextStage);
    assert.equal(nextStage, undefined);

    const prevStage = await db.getStageByOrder(1, stage.guildId);
    assert.notEqual(prevStage, null);
    assert.equal(prevStage.id, nextStageId);
    assert.equal(prevStage.active, false);
    assert.equal(prevStage.ended, true);
    assert.notEqual(prevStage.endedAt, undefined);
    assert.notEqual(prevStage.endedAt, null);
  });

  test('start stage timer sets stage end time', async () => {

    let stage = await db.getActiveStage(guildId);

    await startStageTimer(null, stage, guildId);
    endStageTimer(guildId);

    stage = await db.getActiveStage(guildId);
    expect(stage).toBeTruthy();
    expect(stage.endTime).toBeTruthy();
  });

  test('update stage end time', async () => {
    // Set stage end time
    const newTime = Date.now() + 250;
    await db.updateStageEndTime(stageId, guildId, newTime);

    const stage = await db.getActiveStage(guildId);
    expect(stage).toBeTruthy();
    expect(stage.id).toBe(stageId);
    expect(stage.endTime).toBe(newTime);
  });

  test('start stage timer with preset stage end time', async () => {

    // Set stage end time
    await db.updateStageEndTime(stageId, guildId, Date.now() + 150);

    let stage = await db.getActiveStage(guildId);

    // Start stage timer
    await startStageTimer(null, stage, guildId, 50);
    await pause(250);

    // Expect new stage has started
    stage = await db.getActiveStage(guildId);
    expect(stage).toBeTruthy();
    expect(stage.id).toBe(nextStageId);
  });
});