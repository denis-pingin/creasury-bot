import 'regenerator-runtime/runtime';
import {
  createJoinEvent,
  createLeaveEvent,
  generateMembersWithRandomAccountAge,
  getMockClient,
  getMockGuild,
  loadDataFile,
} from './test-util';
import * as db from '../src/db';
import { MongoClient } from 'mongodb';
import * as discord from '../src/discord';
import { config } from '../src/config';
import util from 'util';
import * as fs from 'fs';
import { getScoreboard } from '../src/ranking';
import { startWatchingEvents } from '../src/events/joinLeave';
import { pause } from '../src/util';

const guildId = '1';
const joinCandidates = generateMembersWithRandomAccountAge(10000, guildId);
const stages = loadDataFile('data/stages.json');
const guildConfig = loadDataFile('data/config.json');

config.guildId = guildId;
config.dbName = 'simulation';

const members = [];

const goal = 250;

const guild = getMockGuild(guildId, members);

const handlers = {};

const client = getMockClient(guild);
client.once = (event, handler) => {
  console.log('Added event handler:', event);
  handlers[event] = handler;
};
client.on = (event, handler) => {
  console.log('Added event handler:', event);
  handlers[event] = handler;
};

joinCandidates.forEach(member => {
  member.guild = guild;
});

function addMember(index) {
  const member = joinCandidates.splice(index, 1)[0];
  members.push(member);
  return member;
}

function removeMember(index) {
  const member = members.splice(index, 1)[0];
  joinCandidates.push(member);
  return member;
}

describe('simulation', () => {
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
    await database.collection('config').insertOne(guildConfig);
  });

  test('stage 1', async () => {
    // Init
    db.init();
    discord.addEventHandlers(client);

    // Add the 1st member
    addMember(0);

    // Ready event
    await handlers.ready.call(this);

    const startTime = Date.now();
    // const stepDurations = [];

    // Simulation until the member goal has been reached
    while (members.length < goal) {
      // Random inviter
      const inviterIndex = Math.floor(Math.random() * members.length);
      const inviter = members[inviterIndex];

      // Add a new member
      const memberIndex = Math.floor(Math.random() * joinCandidates.length);
      const member = addMember(memberIndex);
      await createJoinEvent(member.user.id, inviter.user.id, member.user.createdAt > 100, guildId);

      // Random leave 25% chance
      if (Math.random() > 0.75) {
        const leaverIndex = Math.floor(Math.random() * members.length);
        const leaver = removeMember(leaverIndex);
        await createLeaveEvent(leaver.user.id, guildId);
      }
    }

    const database = await db.getDatabase();
    const events = await database.collection('events').find({}, { sort: { timestamp: 1 } }).toArray();
    fs.writeFileSync(`${__dirname}/simulation/events-${startTime}.json`, util.inspect(events, { showHidden: false, depth: null, colors: false, maxArrayLength: 10000 }));

    // Start event processing
    setTimeout(() => {
      startWatchingEvents(client);
    }, 0);

    // Wait for event processing to complete
    await waitForEventProcessing();

    // Write metrics to file
    const metrics = await db.getMetrics();
    fs.writeFileSync(`${__dirname}/simulation/durations-${startTime}.json`, util.inspect(metrics.map(metric => metric.value), {
      showHidden: false,
      depth: null,
      colors: false,
      maxArrayLength: 10000,
    }));

    const endTime = Date.now();
    console.log('Simulation duration:', endTime - startTime);

    const rankings = await db.getStageRankings(stages[0].id, guildId);
    fs.writeFileSync(`${__dirname}/simulation/rankings-${startTime}.json`, util.inspect(rankings, { showHidden: false, depth: null, colors: false, maxArrayLength: 10000 }));

    const activeStage = await db.getActiveStage(guildId);
    expect(activeStage).toBeTruthy();
    expect(activeStage.id).toBe(stages[0].id);
    if (goal >= stages[0].goals.memberCount) {
      expect(activeStage.endTime).toBeTruthy();
    }

    const scoreboard = await getScoreboard(stages[0], members[0].user, guildId);
    fs.writeFileSync(`${__dirname}/simulation/scoreboard-${startTime}.json`, util.inspect(scoreboard, { showHidden: false, depth: null, colors: false, maxArrayLength: 1000 }));
  });
});

async function waitForEventProcessing() {
  const database = await db.getDatabase();
  let unprocessedEvent = await database.collection('events').findOne({ processed: false });
  while (unprocessedEvent) {
    await pause(10);
    unprocessedEvent = await database.collection('events').findOne({ processed: false });
  }
}