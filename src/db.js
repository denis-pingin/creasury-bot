import { config } from './config';

import { MongoClient, ReturnDocument } from 'mongodb';
import { getUserTag } from './util';
import fs from 'fs';

const cache = {};

export function init() {
  let clean = false;
  process.argv.forEach(function(val, index) {
    if (index > 1 && val === '--clean-db') {
      clean = true;
    }
  });

  getDatabase().then(db => {
    if (clean) {
      db.collection('events').deleteMany({});
      db.collection('members').deleteMany({});
      db.collection('memberCounters').deleteMany({});
      db.collection('stages').deleteMany({});
      db.collection('stageRankings').deleteMany({});

      const stages = JSON.parse(fs.readFileSync(`${__dirname}/../data/stages-dev.json`));
      db.collection('stages').insertMany(stages);
    }

    db.createIndex('members', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'compositePrimaryKey' });
    db.createIndex('memberCounters', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'compositePrimaryKey' });
    db.createIndex('events', { 'type': 1 }, { name: 'type' });
    db.createIndex('events', { 'guildId': 1 }, { name: 'guildId' });
    db.createIndex('events', { 'user.id': 1 }, { name: 'userId' });
    db.createIndex('events', { 'inviter.id': 1 }, { name: 'inviterId' });
    db.createIndex('events', { 'originalInviter.id': 1 }, { name: 'originalInviterId' });
    db.createIndex('events', { 'timestamp': 1 }, { name: 'timestamp' });
    db.createIndex('stages', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'compositePrimaryKey' });
    db.createIndex('stages', { 'active': 1 }, { name: 'active' });
  });
}

export function setConnection(connection) {
  cache.connection = connection;
}

async function getConnection() {
  if (!cache.connection) {
    console.log('Creating MongoDB connection');
    const client = new MongoClient(config.dbConnectionString);
    cache.connection = await client.connect();
  }
  return cache.connection;
}

async function getDatabase() {
  const connection = await getConnection();
  return connection.db(config.dbName);
}

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
  if (stage) {
    const field = `${stage.id}.points`;
    const stagePointsResult = await database.collection('memberCounters').findOne({
      id: userId,
      guildId: guildId,
    }, { projection: { [field]: true } });
    if (stagePointsResult) {
      return getObjectFieldValue(field, stagePointsResult);
    }
  }
}

export async function addJoinEvent(member, inviter, originalInviter, fake) {
  const database = await getDatabase();
  const timestamp = Date.now();
  await database.collection('events').insertOne({
    type: 'join',
    guildId: member.guild.id,
    user: member.user,
    createdAt: member.user.createdAt,
    inviter: inviter,
    originalInviter: originalInviter,
    fake: fake,
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

export async function initMember(user, guildId) {
  const database = await getDatabase();
  await database.collection('members').updateOne({ id: user.id, guildId: guildId }, {
    $set: {
      id: user.id,
      guildId,
      user,
    },
  }, {
    upsert: true,
  });
}

async function addMember(member, inviter, fake) {
  const database = await getDatabase();
  const membersCollection = database.collection('members');

  const rejoin = await membersCollection.findOne({ id: member.user.id, guildId: member.guild.id });
  let newMember;
  if (rejoin) {
    newMember = await membersCollection.findOneAndUpdate({ id: member.user.id, guildId: member.guild.id }, {
      $set: {
        user: member.user,
        inviter: inviter,
        inviteTimestamp: Date.now(),
        fake: fake,
        removed: false,
      },
    }, {
      upsert: true,
      returnDocument: ReturnDocument.AFTER,
    });
    console.log(`A rejoined member ${getUserTag(member.user)} has originally joined on ${rejoin.originalInviteTimestamp} and were invited by ${getUserTag(rejoin.originalInviter)}`);
  } else {
    const timestamp = Date.now();
    newMember = await membersCollection.findOneAndUpdate({ id: member.user.id, guildId: member.guild.id }, {
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
    timestamp: Date.now(),
  });

  const result = await database.collection('members').findOneAndUpdate({
    id: member.user.id,
    guildId: member.guild.id,
  }, {
    $set: {
      id: member.user.id,
      guildId: member.guild.id,
      user: member.user,
      removed: true,
      removeTimestamp: Date.now(),
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
      lastUpdated: Date.now(),
    },
    $inc: { [name]: increment },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  return getObjectFieldValue(name, result.value);
}

export async function getLastTimeReachedThisScore(id, points) {
  const database = await getDatabase();
  const result = await database.collection('events').findOne({
    'originalInviter.id': id,
    stagePoints: points,
  }, { sort: { timestamp: -1 } });
  return result?.timestamp | 0;
}

export async function updateStageRankings(stage, rankings, guildId) {
  const database = await getDatabase();

  const data = {
    stageId: stage.id,
    guildId: guildId,
    rankings: rankings,
    lastUpdated: Date.now(),
  };

  await database.collection('stageRankings').updateOne({ stageId: stage.id, guildId: guildId }, {
    $set: data,
  }, {
    upsert: true,
  });
  await database.collection('stageRankingsLog').insertOne(data);
}

export async function getStageRankings(stageId, guildId) {
  const database = await getDatabase();
  return await database.collection('stageRankings').findOne({ stageId: stageId, guildId: guildId });
}

function getObjectFieldValue(field, value) {
  return field.split('.').reduce((prev, cur) => prev ? prev[cur] : undefined, value);
}

async function getActiveStage() {
  const database = await getDatabase();
  return database.collection('stages').findOne({ active: true });
}

export {
  getConnection,
  getDatabase,
  getOriginalInviter,
  getInviter,
  addMember,
  removeMember,
  updateCounter,
  getActiveStage,
};