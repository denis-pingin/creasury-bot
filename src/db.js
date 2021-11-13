import { config } from './config';

import { MongoClient, ReturnDocument } from 'mongodb';
import { getUserTag } from './util';

const client = new MongoClient(config.dbConnectionString);

async function getDatabase() {
  await client.connect();
  return client.db(config.dbName);
}

getDatabase().then(db => {
  db.createIndex('members', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'ids' });
  db.createIndex('memberCounters', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'ids' });
});

async function getOriginalInviter(member) {
  const database = await getDatabase();
  const invitesCollection = database.collection('members');

  const result = await invitesCollection.findOne({ id: member.user.id, guildId: member.guild.id });
  if (result?.originalInviter) {
    console.log(`Found original inviter for member ${getUserTag(member.user)}: ${getUserTag(result.originalInviter)}.`);
    return result.originalInviter;
  } else {
    console.log(`Warning: inviter for member ${getUserTag(member.user)} not found.`);
  }
}

async function getInviter(member) {
  const database = await getDatabase();
  const invitesCollection = database.collection('members');

  const result = await invitesCollection.findOne({ id: member.user.id, guildId: member.guild.id });
  if (result?.inviter) {
    console.log(`Found inviter for member ${getUserTag(member.user)}: ${getUserTag(result.inviter)}.`);
    return result.inviter;
  } else {
    console.log(`Warning: inviter for member ${getUserTag(member.user)} not found.`);
  }
}

async function addMember(member, inviter, fake) {
  const database = await getDatabase();

  const eventsCollection = database.collection('events');
  await eventsCollection.insertOne({
    type: 'join',
    guildId: member.guild.id,
    user: member.user,
    inviter: inviter,
    fake: fake,
    timestamp: new Date(),
  });

  const invitesCollection = database.collection('members');
  const knownMember = await invitesCollection.findOne({ id: member.user.id, guildId: member.guild.id });
  let newMember;
  if (knownMember) {
    newMember = await invitesCollection.findOneAndUpdate({ id: member.user.id, guildId: member.guild.id }, {
      $set: {
        user: member.user,
        inviter: inviter,
        inviteTimestamp: new Date(),
      },
    }, {
      upsert: true,
      returnDocument: ReturnDocument.AFTER,
    });
    console.log(`A rejoined member ${getUserTag(member.user)} has originally joined on ${knownMember.originalInviteTimestamp} and were invited by ${getUserTag(knownMember.originalInviter)}`);
  } else {
    const timestamp = new Date();
    newMember = await invitesCollection.findOneAndUpdate({ id: member.user.id, guildId: member.guild.id }, {
      $set: {
        id: member.user.id,
        guildId: member.guild.id,
        user: member.user,
        originalInviter: inviter,
        originalInviteTimestamp: timestamp,
        inviter: inviter,
        inviteTimestamp: timestamp,
        fake: fake,
      },
    }, {
      upsert: true,
      returnDocument: ReturnDocument.AFTER,
    });
    console.log(`A new member was added: ${getUserTag(member.user)}`);
  }
  return { member: newMember.value, rejoin: !!knownMember };
}

async function removeMember(member) {
  const database = await getDatabase();

  const eventsCollection = database.collection('events');
  await eventsCollection.insertOne({
    type: 'leave',
    guildId: member.guild.id,
    user: member.user,
    timestamp: new Date(),
  });

  const invitesCollection = database.collection('members');
  const result = await invitesCollection.findOneAndUpdate({ id: member.user.id, guildId: member.guild.id }, {
    $set: {
      removed: true,
      removeTimestamp: new Date(),
    },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  console.log(`Member ${getUserTag(member.user)} was marked as removed.`);
  return { member: result.value };
}

async function updateGlobalCounter(name, user, guildId, increment) {
  const database = await getDatabase();
  const inviteCountCollection = database.collection('memberCounters');
  const result = await inviteCountCollection.findOneAndUpdate({ id: user.id, guildId: guildId }, {
    $set: {
      id: user.id,
      guildId: guildId,
      lastUpdated: new Date(),
    },
    $inc: { [`global.${name}`]: increment },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  return result.value.global[name];
}

export { getOriginalInviter, getInviter, addMember, removeMember, updateGlobalCounter };