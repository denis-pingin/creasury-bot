import fs from 'fs';
import * as db from '../src/db';

export function generateMembers(count, guildId) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push({ user: { id: `${i}`, createdAt: 100, bot: false }, guild: { id: guildId, members: { fetch: () => result } } });
  }
  return result;
}

export function generateMembersWithRandomAccountAge(count, guildId) {
  const result = [];
  for (let i = 0; i < count; i++) {
    // Fake with 20% probability
    let createdAt = 100;
    if (Math.random() > 0.8) {
      createdAt = Date.now();
    }
    result.push({ user: { id: `${i}`, createdAt, bot: false }, guild: { id: guildId, members: { fetch: () => result } } });
  }
  return result;
}

export function loadDataFile(path) {
  return JSON.parse(fs.readFileSync(`${__dirname}/${path}`));
}

export function getMockGuild(guildId, members) {
  return {
    id: guildId,
    // invites: {
    //   fetch: () => {
    //     const invitesObject = {
    //       then: (callback) => {
    //         // logObject('Simulating fetched invites:', invites);
    //         callback.call(this, invites);
    //         return invitesObject;
    //       },
    //       catch: () => {
    //         // noop
    //       },
    //     };
    //     return invitesObject;
    //   },
    // },
    members: {
      fetch: () => {
        return {
          filter: (callback) => {
            // logObject('Simulating fetched members:', members);
            const result = [];
            members.forEach(fetchedMember => {
              if (callback.call(this, fetchedMember)) {
                result.push(fetchedMember);
              }
            });
            return result;
          },
          forEach: (callback) => {
            members.forEach(fetchedMember => {
              callback.call(this, fetchedMember);
            });
          },
        };
      },
    },
  };
}

export function getMockClient(guild) {
  return {
    channels: {
      cache: {
        get: () => {
          return {
            send: (message) => {
              // console.log(`Intercept message: ${message}`);
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
}

export function getInvitesMock(invites) {
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

let eventCounter = 0;

export async function createJoinEvent(userId, inviterId, fake, guildId) {
  const database = await db.getDatabase();
  await database.collection('events').insertOne({
    type: 'join',
    guildId: guildId,
    user: {
      id: userId,
    },
    createdAt: 100,
    inviter: {
      id: inviterId,
    },
    fake: fake,
    timestamp: eventCounter++,
    processed: false,
  });
}

export async function createLeaveEvent(userId, guildId) {
  const database = await db.getDatabase();
  await database.collection('events').insertOne({
    type: 'leave',
    guildId: guildId,
    user: {
      id: userId,
    },
    timestamp: eventCounter++,
    processed: false,
  });
}