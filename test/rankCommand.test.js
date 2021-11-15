import 'regenerator-runtime/runtime';
import { getDatabase, setConnection } from '../src/db';
import { execute } from '../src/commands/rank';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import handleGuildMemberAdd from '../src/events/guildMemberAdd';
import handleGuildMemberRemove from '../src/events/guildMemberRemove';

const stage = 'Newborn Butterflies: Stage 1';
const guildId = '1';

const members = [
  { user: { id: '1', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '2', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '3', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '4', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '5', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '6', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '7', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '8', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '9', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '10', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '11', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '12', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '13', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '14', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '15', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '16', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '17', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '18', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '19', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '20', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '21', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '22', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '23', createdAt: 100 }, guild: { id: guildId } },
  { user: { id: '24', createdAt: 100 }, guild: { id: guildId } },
];

describe('rank command', () => {
  let connection;

  beforeAll(async () => {
    connection = await MongoClient.connect(global.__MONGO_URI__, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    setConnection(connection);

    await clearData();

    const stages = JSON.parse(fs.readFileSync(`${__dirname}/data/stages.json`));
    const database = await getDatabase();
    database.collection('stages').insertMany(stages);
  });

  afterAll(async () => {
    // await connection.close();
  });

  test('regular rank', async () => {

    // Add member without inviter
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
    await handleGuildMemberRemove(null, members[7]);
    await handleGuildMemberAdd(null, members[7], members[2].user);
    await handleGuildMemberRemove(null, members[19]);

    const interation = {
      user: {
        id: members[0].user.id,
      },
      guildId: guildId,
      guild: {
        members: {
          fetch: () => {
            return members;
          },
        },
      },
      reply: (message) => {
        console.log(`Reply: ${message}`);
      },
    };
    await execute(interation);
  });
});

async function clearData() {
  const database = await getDatabase();
  await database.collection('events').deleteMany({});
  await database.collection('members').deleteMany({});
  await database.collection('memberCounters').deleteMany({});
  await database.collection('stages').deleteMany({});
}