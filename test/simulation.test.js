import 'regenerator-runtime/runtime';
import { generateMembersWithRandomAccountAge, loadDataFile } from './test-util';
import * as db from '../src/db';
import { MongoClient } from 'mongodb';
import * as discord from '../src/discord';
import { config } from '../src/config';
import util from 'util';
import * as fs from 'fs';
import { getLeaderboard } from '../src/ranking';

const guildId = '1';
const allMembers = generateMembersWithRandomAccountAge(500, guildId);
const stages = loadDataFile('data/stages.json');
const guildConfig = loadDataFile('data/config.json');
config.guildId = guildId;
config.dbName = 'simulation';
const invites = { };
const members = [];
const goal = 250;
const getInvites = jest.fn();
const getMembers = jest.fn();
const guild = {
  id: guildId,
  invites: {
    fetch: () => {
      const invitesObject = {
        then: (callback) => {
          const fetchedInvites = getInvites();
          // logObject('Simulating fetched invites:', fetchedInvites);
          callback.call(this, fetchedInvites);
          return invitesObject;
        },
        catch: () => {
          // noop
        },
      };
      return invitesObject;
    },
  },
  members: {
    fetch: () => {
      const fetchedMembers = getMembers();
      const membersObject = {
        filter: (callback) => {
          // logObject('Simulating fetched members:', fetchedMembers);
          const result = [];
          fetchedMembers.forEach(fetchedMember => {
            if (callback.call(this, fetchedMember)) {
              result.push(fetchedMember);
            }
          });
          return result;
        },
        forEach: (callback) => {
          fetchedMembers.forEach(fetchedMember => {
            callback.call(this, fetchedMember);
          });
        },
      };
      return membersObject;
    },
  },
};
const handlers = {};
const client = {
  once: (event, handler) => {
    console.log('Added event handler:', event);
    handlers[event] = handler;
  },
  on: (event, handler) => {
    console.log('Added event handler:', event);
    handlers[event] = handler;
  },
  channels: {
    cache: {
      get: () => {
        return {
          send: (message) => {
            console.log(`Intercept message: ${message}`);
          },
        };
      },
    },
  },
  guilds: {
    cache: {
      get: () => {
        return guild;
      },
      filter: () => {
        return [guild];
      },
      forEach: (callback) => {
        callback.call(this, guild);
      },
    },
  },
};
allMembers.forEach(member => {
  member.guild = guild;
});

describe('simulation', () => {
  // let connection;
  //
  // beforeAll(async () => {
  //   connection = await MongoClient.connect(global.__MONGO_URI__, {
  //     useNewUrlParser: true,
  //     useUnifiedTopology: true,
  //   });
  //   db.setConnection(connection);
  // });

  beforeEach(async () => {
    await db.clearData();
    const database = await db.getDatabase();
    await database.collection('stages').insertMany(stages);
    await database.collection('config').insertOne(guildConfig);
  });

  // afterAll(async () => {
  //
  // });

  test('stage 1', async () => {
    // Init
    db.init();
    discord.addEventHandlers(client);
    members.push(allMembers[0]);
    getInvites.mockReturnValue(getInvitesMock());
    getMembers.mockReturnValue(members);

    // Ready event
    await handlers.ready.call(this);

    // Create the first invite
    let invite = createInvite(guild, members[0], 0);
    invites[members[0].user.id] = invite;
    await handlers.inviteCreate.call(this, invite);

    const startTime = Date.now();
    const stepDurations = [];

    // Simulation until the member goal has been reached
    while (members.length < goal) {
      const stepStartTime = Date.now();

      // Random inviter
      const inviterIndex = Math.floor(Math.random() * members.length);

      // Increment invite uses
      invites[members[inviterIndex].user.id].uses += 1;

      // Add new member
      const joinCandidates = allMembers.filter(m1 => members.indexOf(m2 => m2.user.id === m1.user.id) < 0);
      const member = joinCandidates[Math.floor(Math.random() * joinCandidates.length)];
      members.push(member);
      await handlers.guildMemberAdd.call(this, member);

      // Create invite if not already created
      if (!invites[member.user.id]) {
        invite = createInvite(guild, member, 0);
        invites[member.user.id] = invite;
        await handlers.inviteCreate.call(this, invite);
      }

      // Random leave 25% chance
      if (Math.random() > 0.75) {
        const leaverIndex = Math.floor(Math.random() * members.length);
        const leaver = members[leaverIndex];
        members.splice(leaverIndex, 1);
        await handlers.guildMemberRemove.call(this, leaver);
      }

      const stepEndTime = Date.now();
      stepDurations.push(stepEndTime - stepStartTime);
      fs.writeFileSync(`${__dirname}/simulation/durations-${startTime}.json`, util.inspect(stepDurations, { showHidden: false, depth: null, colors: false, maxArrayLength: 1000 }));
    }

    const endTime = Date.now();
    console.log('Simulation duration:', endTime - startTime);
    console.log('Min step duration:', stepDurations.reduce((prev, cur) => cur < prev ? cur : prev, Number.MAX_VALUE));
    console.log('Max step duration:', stepDurations.reduce((prev, cur) => cur > prev ? cur : prev, Number.MIN_VALUE));
    console.log('Average step duration:', stepDurations.reduce((prev, cur) => cur + prev, 0) / stepDurations.length);

    const rankings = await db.getStageRankings(stages[0].id, guildId);
    fs.writeFileSync(`${__dirname}/simulation/rankings-${startTime}.json`, util.inspect(rankings, { showHidden: false, depth: null, colors: false, maxArrayLength: 1000 }));

    const activeStage = await db.getActiveStage(guildId);
    expect(activeStage).toBeTruthy();
    expect(activeStage.id).toBe(stages[0].id);
    if (goal >= stages[0].goals.memberCount) {
      expect(activeStage.endTime).toBeTruthy();
    }

    const leaderboard = await getLeaderboard(stages[0], members[0].user, guildId);
    fs.writeFileSync(`${__dirname}/simulation/leaderboard-${startTime}.json`, util.inspect(leaderboard, { showHidden: false, depth: null, colors: false, maxArrayLength: 1000 }));
  });
});

function createInvite(guild, member, uses) {
  return {
    guild: guild,
    code: `invite-code-${member.user.id}`,
    uses: uses,
    channel: {
      id: 'invited-to-channel',
    },
    inviter: member.user,
  };
}

function getInvitesMock() {
  return {
    each: (callback) => {
      Object.values(invites).forEach(i => {
        callback.call(this, i);
      });
    },
    find: (callback) => {
      for (const inv of Object.values(invites)) {
        if (callback.call(this, inv)) {
          return inv;
        }
      }
    },
    values: () => {
      return Object.values(invites);
    },
  };
}