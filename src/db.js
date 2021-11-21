import { config } from './config';

import { MongoClient, ReturnDocument } from 'mongodb';
import { getUserTag, pause } from './util';

const cache = {};

export function init() {
  // let clean = false;
  // process.argv.forEach(function(val, index) {
  //   if (index > 1 && val === '--clean-db') {
  //     clean = true;
  //   }
  // });

  getDatabase().then(async db => {
    // if (clean) {
    //   await clearData();
    //   const stages = JSON.parse(fs.readFileSync(`${__dirname}/../data/dev/stages.json`));
    //   db.collection('stages').insertMany(stages);
    // }

    db.createIndex('members', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'compositePrimaryKey' });
    db.createIndex('memberCounters', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'compositePrimaryKey' });
    db.createIndex('events', { 'type': 1 }, { name: 'type' });
    db.createIndex('events', { 'guildId': 1 }, { name: 'guildId' });
    db.createIndex('events', { 'user.id': 1 }, { name: 'userId' });
    db.createIndex('events', { 'inviter.id': 1 }, { name: 'inviterId' });
    db.createIndex('events', { 'originalInviter.id': 1 }, { name: 'originalInviterId' });
    db.createIndex('events', { 'timestamp': 1 }, { name: 'timestamp' });
    db.createIndex('events', { 'stagePoints': 1 }, { name: 'stagePoints' });
    db.createIndex('events', { 'processed': 1 }, { name: 'processed' });
    db.createIndex('stages', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'compositePrimaryKey' });
    db.createIndex('stages', { 'active': 1 }, { name: 'active' });
    db.createIndex('stages', { 'order': 1 }, { name: 'order' });
    db.createIndex('stages', { 'ended': 1 }, { name: 'ended' });
    db.createIndex('config', { 'guildId': 1 }, { name: 'guildId' });
    db.createIndex('rewards', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'compositePrimaryKey' });
    db.createIndex('stageRankings', { 'stageId': 1, 'guildId': 1 }, { unique: true, name: 'compositePrimaryKey' });
  });
}

export async function clearData() {
  const database = await getDatabase();
  await database.collection('events').deleteMany({});
  await database.collection('members').deleteMany({});
  await database.collection('memberCounters').deleteMany({});
  await database.collection('stages').deleteMany({});
  await database.collection('stageRankings').deleteMany({});
  await database.collection('config').deleteMany({});
  await database.collection('rewards').deleteMany({});
}

export function setConnection(connection) {
  cache.connection = connection;
}

export async function getConnection() {
  if (!cache.connection) {
    console.log('Creating MongoDB connection');
    const client = new MongoClient(config.dbConnectionString);
    cache.connection = await client.connect();
  }
  return cache.connection;
}

export async function getDatabase() {
  const connection = await getConnection();
  return connection.db(config.dbName);
}


async function getUnprocessedEvent(database) {
  return await database.collection('events').findOne({ processed: false }, { sort: { timestamp: 1 } });
}

export async function startWatchingEvents(callback) {
  cache.running = true;
  const database = await getDatabase();
  while (cache.running) {
    let event = await getUnprocessedEvent(database);
    while (!event && cache.running) {
      await pause(1000);
      event = await getUnprocessedEvent(database);
    }
    if (event) {
      await callback(event);
    }
  }
}

export function stopWatchingEvents() {
  cache.running = false;
}

export async function getGuildConfig(guildId) {
  const database = await getDatabase();
  const result = await database.collection('config').findOneAndUpdate({ guildId }, {
    $set: {
      guildId: guildId,
    },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  const guildConfig = result.value;
  if (!guildConfig.excludedFromRanking) {
    guildConfig.excludedFromRanking = [];
  }
  return guildConfig;
}

export async function getStagePoints(userId, guildId) {
  const database = await getDatabase();
  const stage = await getActiveStage(guildId);
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

export async function updateJoinEvent(event, stagePoints, originalInviter) {
  const database = await getDatabase();

  const updatedEvent = {
    ...event,
    originalInviter,
    stagePoints,
    processed: true,
  };
  delete updatedEvent._id;

  await database.collection('events').updateOne({
    type: 'join',
    'user.id': event.user.id,
    timestamp: event.timestamp,
    guildId: event.guildId,
  }, {
    $set: updatedEvent,
  }, {
    upsert: true,
  });
}

export async function updateLeaveEvent(event) {
  const database = await getDatabase();

  const updatedEvent = {
    ...event,
    processed: true,
  };
  delete updatedEvent._id;

  await database.collection('events').updateOne({
    type: 'leave',
    'user.id': event.user.id,
    timestamp: event.timestamp,
    guildId: event.guildId,
  }, {
    $set: updatedEvent,
  }, {
    upsert: true,
  });
}

export async function initMembers(members) {
  const database = await getDatabase();
  const bulkOp = database.collection('members').initializeUnorderedBulkOp();

  members.forEach(member => {
    bulkOp.find({ id: member.user.id, guildId: member.guild.id }).upsert().updateOne({
      $set: {
        id: member.user.id,
        guildId: member.guild.id,
        user: member.user,
      },
    });
  });

  if (members.length > 0) {
    const result = await bulkOp.execute();
    return result.upserted;
  }
}

export async function addMember(user, inviter, fake, guildId) {
  const database = await getDatabase();
  const membersCollection = database.collection('members');

  const rejoin = await membersCollection.findOne({ id: user.id, guildId: guildId });
  let newMember;
  if (rejoin) {
    newMember = await membersCollection.findOneAndUpdate({ id: user.id, guildId: guildId }, {
      $set: {
        user: user,
        inviter: inviter,
        inviteTimestamp: Date.now(),
        fake: fake,
        removed: false,
      },
    }, {
      upsert: true,
      returnDocument: ReturnDocument.AFTER,
    });
    console.log(`A rejoined member ${getUserTag(user)} has originally joined on ${rejoin.originalInviteTimestamp} and were invited by ${getUserTag(rejoin.originalInviter)}`);
  } else {
    const timestamp = Date.now();
    newMember = await membersCollection.findOneAndUpdate({ id: user.id, guildId: guildId }, {
      $set: {
        id: user.id,
        guildId: guildId,
        user: user,
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
    console.log(`A new member was added: ${getUserTag(user)}`);
  }
  return { member: newMember.value, rejoin: !!rejoin };
}

export async function removeMember(user, guildId) {
  const database = await getDatabase();

  const result = await database.collection('members').findOneAndUpdate({
    id: user.id,
    guildId: guildId,
  }, {
    $set: {
      id: user.id,
      guildId: guildId,
      user: user,
      removed: true,
      removeTimestamp: Date.now(),
    },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  console.log(`Member ${getUserTag(user)} was marked as removed.`);
  return { member: result.value };
}

export async function updateCounter(counter, user, guildId, increment) {
  const database = await getDatabase();

  const result = await database.collection('memberCounters').findOneAndUpdate({ id: user.id, guildId: guildId }, {
    $set: {
      id: user.id,
      guildId: guildId,
      lastUpdated: Date.now(),
    },
    $inc: { [counter]: increment },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  return getObjectFieldValue(counter, result.value);
}

export async function getCounters(counter, userIds, stageId, guildId) {
  const database = await getDatabase();
  const counters = await database.collection('memberCounters')
    .find({ id: { $in: userIds }, guildId }, { projection: { id: true, [counter]: true } }).toArray();

  // Create counters map for lookup
  const countersMap = counters.reduce((prev, cur) => {
    prev[cur.id] = cur ? cur[stageId] ? cur[stageId].points | 0 : 0 : 0;
    return prev;
  }, {});

  // Map user IDs to points
  return userIds.map(userId => {
    return {
      id: userId,
      points: countersMap[userId] ? countersMap[userId] : 0,
    };
  });
}

export async function getLastTimeReachedThisScore(userIds, points, guildId) {
  const database = await getDatabase();
  const result = await database.collection('events')
    .find({
      type: 'join',
      'originalInviter.id': { $in: userIds },
      stagePoints: points,
      guildId: guildId,
    }, {
      projection: {
        'originalInviter.id': true,
        timestamp: true,
      },
      sort: { timestamp: 1 },
    }).toArray();
  return result.reduce((prev, cur) => {
    prev[cur.originalInviter.id] = cur.timestamp | 0;
    return prev;
  }, {});
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

export async function getStageById(id, guildId) {
  const database = await getDatabase();
  return await database.collection('stages').findOne({ id, guildId });
}

export async function getStageByOrder(order, guildId) {
  const database = await getDatabase();
  return await database.collection('stages').findOne({ order, guildId });
}

export async function getActiveStage(guildId) {
  const database = await getDatabase();
  return await database.collection('stages').findOne({ active: true, guildId });
}

export async function getPreviousStage(guildId) {
  const database = await getDatabase();
  const activeStage = await getActiveStage(guildId);
  if (activeStage) {
    // Get stage with the previous order
    const prevStageOrder = activeStage.order - 1;
    if (prevStageOrder >= 0) {
      return await getStageByOrder(prevStageOrder, guildId);
    }
  } else {
    // Get ended stage with the maximum order
    return await database.collection('stages').findOne({ guildId, ended: true }, { sort: { order: -1 }, limit: 1 });
  }
}

export async function startStage(id, guildId) {
  const database = await getDatabase();
  const result = await database.collection('stages').findOneAndUpdate({ 'id': id, guildId: guildId }, {
    $set: {
      started: true,
      startedAt: Date.now(),
      active: true,
    },
  }, {
    returnDocument: ReturnDocument.AFTER,
  });
  return result.value;
}

export async function endStage(id, guildId) {
  const database = await getDatabase();
  return await database.collection('stages').findOneAndUpdate({ 'id': id, guildId: guildId }, {
    $set: {
      ended: true,
      endedAt: Date.now(),
      active: false,
    },
  }, {
    returnDocument: ReturnDocument.AFTER,
  });
}

export async function updateStageEndTime(id, guildId, time) {
  const database = await getDatabase();
  return await database.collection('stages').updateOne({ 'id': id, guildId: guildId }, {
    $set: {
      endTime: time,
    },
  });
}

export async function assignReward(userId, guildId, reward) {
  const database = await getDatabase();

  // Remove the supply property
  reward = { ...reward };
  delete reward.supply;

  const result = await database.collection('rewards').findOneAndUpdate({ id: userId, guildId: guildId }, {
    $set: {
      id: userId,
      guildId: guildId,
    },
    $push: {
      [reward.type]: reward,
    },
  }, {
    upsert: true,
    returnDocument: ReturnDocument.AFTER,
  });
  return result.value;
}

export async function updateStageRewardState(stageId, guildId, level, reward, state) {
  const database = await getDatabase();

  await database.collection('stages').updateOne({ id: stageId, guildId: guildId }, {
    $pull: {
      [`rewards.pending.${level}`]: {
        id: reward.id,
      },
    },
    $push: {
      [`rewards.${state}.${level}`]: reward,
    },
  }, {
    upsert: true,
  });
}

export async function getMemberRewards(userId, guildId) {
  const database = await getDatabase();
  return await database.collection('rewards').findOne({ id: userId, guildId: guildId });
}

export async function addMetric(type, value) {
  const database = await getDatabase();
  return await database.collection('metrics').insertOne({
    type,
    value,
    timestamp: Date.now(),
  });
}

export async function getMetrics() {
  const database = await getDatabase();
  return await database.collection('metrics').find({}, { sort: { timestamp: -1 } }).toArray();
}
