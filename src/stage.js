import * as db from './db';

export function getStageEndTime(date) {
  if (!date) {
    date = new Date();
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()));
  }
  const hours = date.getHours();
  let dayOfMonth = date.getDate();
  if (hours >= 12) {
    dayOfMonth++;
  }
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), dayOfMonth, 12, 0));
}

const timers = {};

export async function startStageTimer(stage, guildId, timeout = 1000) {
  let stageEndTime;
  if (!stage.endTime) {
    stageEndTime = getStageEndTime();
    await db.updateStageEndTime(stage.id, guildId, stageEndTime.getTime());
    console.log(`Setting stage end time to ${stageEndTime}`);
  } else {
    stageEndTime = new Date(stage.endTime);
    console.log(`Stage end time is already set to ${stageEndTime}`);
  }

  startTimer(guildId, stageEndTime, stage, timeout);
  console.log(`Started timer for stage ${stage.id} and guild ${guildId}, ending at ${stageEndTime}`);
  return stageEndTime;
}

function startTimer(guildId, stageEndTime, stage, timeout) {
  if (timers[guildId]) {
    console.log(`Stage timer for guild ${guildId} is already running!`);
    return;
  }
  timers[guildId] = setTimeout(async () => {
    // Check if time is up
    if (Date.now() >= stageEndTime.getTime()) {
      console.log(`Stage ${stage.id} ended!`);
      clearTimeout(timers[guildId]);
      await switchStage(stage);
      delete timers[guildId];
    } else {
      delete timers[guildId];
      startTimer(guildId, stageEndTime, stage, timeout);
    }
  }, timeout);
}

export function endStageTimer(guildId) {
  if (timers[guildId]) {
    clearTimeout(timers[guildId]);
    delete timers[guildId];
  }
}

export async function switchStage(stage) {
  // End the current stage
  await db.endStage(stage.id, stage.guildId);

  // Find the next stage
  const nextStageOrder = stage.order + 1;
  let nextStage = await db.getStageByOrder(nextStageOrder, stage.guildId);

  if (nextStage) {
    console.log(`Starting the next stage **${nextStage.id}**`);

    // Start the next stage
    nextStage = await db.startStage(nextStage.id, nextStage.guildId);
    console.log(`Stage **${nextStage.id}** has been started!`);
    return nextStage;
  } else {
    console.log(`The next stage with order ${nextStageOrder} couldn't be found.`);
  }
}