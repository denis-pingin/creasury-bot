'use strict';
import 'regenerator-runtime/runtime';
import { MongoClient } from 'mongodb';
import * as db from '../src/db';
import { loadDataFile } from './test-util';
import { getMembers } from '../src/guild';

const guildId = '1';
const members = loadDataFile('data/members.json');
const config = loadDataFile('data/config.json');

describe('guild', () => {
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
    await database.collection('config').insertOne(config);
  });

  test('init members', async () => {
    await db.initMembers(members);

    const database = await db.getDatabase();
    expect(await database.collection('members').findOne({ id: '1', guildId })).toBeTruthy();
    expect(await database.collection('members').findOne({ id: '2', guildId })).toBeTruthy();
    expect(await database.collection('members').findOne({ id: '12', guildId })).toBeTruthy();
  });

  test('get members', async () => {
    const guild = {
      id: '1',
      members: {
        fetch: jest.fn(),
      },
    };
    guild.members.fetch.mockReturnValueOnce(members);

    const result = await getMembers(guild, config);
    console.log('Members:', result);
    expect(result).toBeTruthy();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });
});