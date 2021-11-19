import 'regenerator-runtime/runtime';
import { generateMembers, loadDataFile, pause } from './test-util';
import * as db from '../src/db';
import { MongoClient } from 'mongodb';
import * as discord from '../src/discord';
import { logObject } from '../src/util';
import { config } from '../src/config';
import util from 'util';
import * as fs from 'fs';
import { getLeaderboard } from '../src/ranking';

const guildId = '1';
const allMembers = generateMembers(500, guildId);
const stages = loadDataFile('data/stages.json');
const guildConfig = loadDataFile('data/config.json');
config.guildId = guildId;
const invites = [];
const members = [];

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

  test.skip('stage 1', async () => {
    const handlers = {};
    const getInvites = jest.fn();
    const getMembers = jest.fn();
    const guild = {
      id: guildId,
      invites: {
        fetch: () => {
          const invitesObject = {
            then: (callback) => {
              const fetchedInvites = getInvites();
              logObject('Simulating fetched invites:', fetchedInvites);
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
              logObject('Simulating fetched members:', fetchedMembers);
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

    // Augment members
    allMembers.forEach(member => {
      member.guild = guild;
    });

    // Add the first member
    members.push(allMembers[0]);

    // Init
    db.init();
    discord.addEventHandlers(client);

    // Mock no invites and one member in the guild
    getInvites.mockReturnValue(getInvitesMock());
    getMembers.mockReturnValue(members);

    // Ready event
    await handlers.ready.call(this);

    // Create invite
    let invite = createInvite(guild, members[0], 0);
    invites.push(invite);
    await handlers.inviteCreate.call(this, invite);

    while (members.length < 250) {
      // Random inviter
      const inviterIndex = Math.floor(Math.random() * members.length);

      // Increment invite uses
      invites[inviterIndex].uses += 1;

      // Add new member
      const joinCandidates = allMembers.filter(m1 => members.indexOf(m2 => m2.user.id === m1.user.id) < 0);
      const member = joinCandidates[Math.floor(Math.random() * joinCandidates.length)];
      // const member = allMembers[members.length];
      members.push(member);
      await handlers.guildMemberAdd.call(this, member);

      // Create invite
      if (invites.findIndex(i => i.inviter.id === member.user.id) < 0) {
        console.log(`Creating new invite for member ${member.user.id}`);
        invite = createInvite(guild, member, 0);
        invites.push(invite);
        await handlers.inviteCreate.call(this, invite);
      }

      // Random leave 25% chance
      if (Math.random() > 0.75) {
        const leaverIndex = Math.floor(Math.random() * members.length);
        const leaver = members[leaverIndex];
        console.log(`Member ${leaver.user.id} will leave`);
        members.splice(leaverIndex, 1);
        await handlers.guildMemberRemove.call(this, leaver);
      }
    }

    const rankings = await db.getStageRankings(stages[0].id, guildId);
    const timestamp = Date.now();
    fs.writeFileSync(`${__dirname}/simulation/rankings-${timestamp}.json`, util.inspect(rankings, { showHidden: false, depth: null, colors: false, maxArrayLength: 1000 }));

    const activeStage = await db.getActiveStage(guildId);
    expect(activeStage).toBeTruthy();
    expect(activeStage.id).toBe(stages[0].id);
    expect(activeStage.endTime).toBeTruthy();

    const leaderboard = await getLeaderboard(stages[0], members[0].user, guildId);
    fs.writeFileSync(`${__dirname}/simulation/leaderboard-${timestamp}.json`, util.inspect(leaderboard, { showHidden: false, depth: null, colors: false, maxArrayLength: 1000 }));
  });
});

function createInvite(guild, member, uses) {
  // if (invitesByMembers[member.id]) {
  //   invitesByMembers[member.id].uses += 1;
  // }
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
      invites.forEach(i => {
        callback.call(this, i);
      });
    },
    find: (callback) => {
      for (let i = 0; i < invites.length; i++) {
        const inv = invites[i];
        if (callback.call(this, inv)) {
          return inv;
        }
      }
    },
    values: () => {
      return invites;
    },
  };
}