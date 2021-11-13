import { config } from './config';

import { MongoClient, ReturnDocument } from 'mongodb';
import { getUserTag } from './util';

// Replace the uri string with your MongoDB deployment's connection string.
const client = new MongoClient(config.dbConnectionString);

async function getDatabase() {
  await client.connect();
  return client.db(config.dbName);
}

getDatabase().then(db => {
  db.createIndex('members', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'ids' });
  db.createIndex('memberCounters', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'ids' });
});

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

async function addMember(member, inviter) {
  const database = await getDatabase();

  const eventsCollection = database.collection('events');
  await eventsCollection.insertOne({
    type: 'join',
    guildId: member.guild.id,
    user: member.user,
    inviter: inviter,
    timestamp: new Date(),
  });

  const invitesCollection = database.collection('members');
  const knownMember = await invitesCollection.findOne({ id: member.user.id, guildId: member.guild.id });
  if (knownMember) {
    await invitesCollection.updateOne({ id: member.user.id, guildId: member.guild.id }, {
      $set: {
        id: member.user.id,
        guildId: member.guild.id,
        user: member.user,
        originalInviter: knownMember.originalInviter,
        originalInviteTimestamp: knownMember.originalInviteTimestamp,
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
    await invitesCollection.updateOne({ id: member.user.id, guildId: member.guild.id }, {
      $set: {
        id: member.user.id,
        guildId: member.guild.id,
        user: member.user,
        originalInviter: inviter,
        originalInviteTimestamp: timestamp,
        inviter: inviter,
        inviteTimestamp: timestamp,
      },
    }, {
      upsert: true,
      returnDocument: ReturnDocument.AFTER,
    });
    console.log(`A new member was added: ${getUserTag(member.user)}`);
  }
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
  await invitesCollection.findOneAndUpdate({ id: member.user.id, guildId: member.guild.id }, {
    $set: {
      removed: true,
      removeTimestamp: new Date(),
    },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  console.log(`Member ${getUserTag(member.user)} was marked as removed.`);
}

async function incrementGlobalInvites(inviter, guildId) {
  const result = await updateGlobalInvitesCounter(inviter, guildId, 1);
  console.log(`Invite count incremented for user ${getUserTag(inviter)}, they now have ${result.value.global.invites} invites.`);
  return result.value.global.invites;
}

async function decrementGlobalInvites(inviter, guildId) {
  const result = await updateGlobalInvitesCounter(inviter, guildId, -1);
  console.log(`Invite count decremented for user ${getUserTag(inviter)}, they now have ${result.value.global.invites} invites.`);
  return result.value.global.invites;
}

async function updateGlobalInvitesCounter(inviter, guildId, increment) {
  const database = await getDatabase();
  const inviteCountCollection = database.collection('memberCounters');
  return await inviteCountCollection.findOneAndUpdate({ id: inviter.id, guildId: guildId }, {
    $set: {
      id: inviter.id,
      guildId: guildId,
      lastUpdated: new Date(),
    },
    $inc: { 'global.invites': increment },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
}

export { getInviter, addMember, removeMember, incrementGlobalInvites, decrementGlobalInvites };