import { config } from './config';

import { MongoClient, ReturnDocument } from 'mongodb';
import { getUserTag } from './util';

// Replace the uri string with your MongoDB deployment's connection string.
const client = new MongoClient(config.dbConnectionString);

async function getDatabase() {
  await client.connect();
  return client.db(config.dbName);
}

async function getInviter(member) {
  const database = await getDatabase();
  const invitesCollection = database.collection('invites');

  const result = await invitesCollection.findOne({ id: member.user.id, guildId: member.guild.id });
  if (result) {
    console.log(`Found inviter for member ${getUserTag(member.user)}: ${getUserTag(result.inviter)}.`);
    return result.inviter;
  } else {
    console.log(`Warning: inviter for member ${getUserTag(member.user)} not found.`);
  }
}

async function addMember(member, inviter) {
  const database = await getDatabase();
  const invitesCollection = database.collection('invites');

  await invitesCollection.updateOne({ id: member.user.id, guildId: member.guild.id }, {
    $set: {
      id: member.user.id,
      guildId: member.guild.id,
      user: member.user,
      inviter: inviter,
      inviteTimestamp: new Date(),
    },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  console.log(`A new member was added: ${getUserTag(member.user)}`);
}

async function removeMember(member) {
  const database = await getDatabase();
  const invitesCollection = database.collection('invites');

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

async function incrementInvites(inviter, guildId) {
  const database = await getDatabase();
  const inviteCountCollection = database.collection('inviteCount');

  const result = await inviteCountCollection.findOneAndUpdate({ id: inviter.id, guildId: guildId }, {
    $set: {
      id: inviter.id,
      guildId: guildId,
      lastUpdated: new Date(),
    },
    $inc: { 'invites': 1 },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  console.log(`Invite count incremented for user ${getUserTag(inviter)}, they now have ${result.value.invites} invites.`);
}

async function decrementInvites(inviter, guildId) {
  const database = await getDatabase();
  const inviteCountCollection = database.collection('inviteCount');

  const result = await inviteCountCollection.findOneAndUpdate({ id: inviter.id, guildId: guildId }, {
    $set: {
      id: inviter.id,
      guildId: guildId,
      lastUpdated: new Date(),
    },
    $inc: { 'invites': -1 },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  console.log(`Invite count decremented for user ${getUserTag(inviter)}, they now have ${result.value.invites} invites.`);
}

export { getInviter, addMember, removeMember, incrementInvites, decrementInvites };