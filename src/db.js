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
  const membersCollection = database.collection('members');

  const result = await membersCollection.findOne({ id: member.user.id, guildId: member.guild.id });
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

export async function getStagePoints(userId, guildId) {
  const database = await getDatabase();
  const stage = await getActiveStage();
  const field = `${stage.id}.points`;
  if (stage) {
    const stagePointsResult = await database.collection('memberCounters').findOne({ id: userId, guildId: guildId }, { projection: { [field]: true } });
    if (stagePointsResult) {
      return getObjectFieldValue(field, stagePointsResult);
    }
  }
}

export async function addJoinEvent(member, inviter, fake, stagePoints) {
  const database = await getDatabase();
  const timestamp = new Date();
  await database.collection('events').insertOne({
    type: 'join',
    guildId: member.guild.id,
    user: member.user,
    inviter: inviter,
    fake: fake,
    stagePoints: stagePoints,
    timestamp: timestamp,
  });
  return timestamp;
}

export async function updateJoinEvent(userId, timestamp, stagePoints) {
  const database = await getDatabase();
  await database.collection('events').updateOne({ 'user.id': userId, timestamp: timestamp }, {
    $set: {
      stagePoints: stagePoints,
    },
  });
}

async function addMember(member, inviter, fake) {
  const database = await getDatabase();

  const invitesCollection = database.collection('members');
  const rejoin = await invitesCollection.findOne({ id: member.user.id, guildId: member.guild.id });
  let newMember;
  if (rejoin) {
    newMember = await invitesCollection.findOneAndUpdate({ id: member.user.id, guildId: member.guild.id }, {
      $set: {
        user: member.user,
        inviter: inviter,
        inviteTimestamp: new Date(),
        fake: fake,
        removed: false,
      },
    }, {
      upsert: true,
      returnDocument: ReturnDocument.AFTER,
    });
    console.log(`A rejoined member ${getUserTag(member.user)} has originally joined on ${rejoin.originalInviteTimestamp} and were invited by ${getUserTag(rejoin.originalInviter)}`);
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
  return { member: newMember.value, rejoin: !!rejoin };
}

async function removeMember(member) {
  const database = await getDatabase();

  await database.collection('events').insertOne({
    type: 'leave',
    guildId: member.guild.id,
    user: member.user,
    timestamp: new Date(),
  });

  const result = await database.collection('members').findOneAndUpdate({ id: member.user.id, guildId: member.guild.id }, {
    $set: {
      id: member.user.id,
      guildId: member.guild.id,
      user: member.user,
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

async function updateCounter(name, user, guildId, increment) {
  const database = await getDatabase();

  const result = await database.collection('memberCounters').findOneAndUpdate({ id: user.id, guildId: guildId }, {
    $set: {
      id: user.id,
      guildId: guildId,
      lastUpdated: new Date(),
    },
    $inc: { [name]: increment },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  return getObjectFieldValue(name, result.value);
}

function getObjectFieldValue(field, value) {
  return field.split('.').reduce((prev, cur) => prev ? prev[cur] : undefined, value);
}

async function getActiveStage() {
  const database = await getDatabase();
  return database.collection('stages').findOne({ active: true });
}

export { getDatabase, getOriginalInviter, getInviter, addMember, removeMember, updateCounter, getActiveStage };