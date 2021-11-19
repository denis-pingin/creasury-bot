import * as db from './db';
import { sendInviteMessage, sendLogMessage } from './util';

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

export async function checkStageGoal(client, stage, members) {
  let message;
  const memberGoal = stage.goals?.memberCount;
  // Stage end time has not been set yet and there is a member goal
  if (!stage.endTime && memberGoal) {
    // Member goal reached
    if (members.length >= memberGoal) {
      await sendLogMessage(client, `The stage goal of ${memberGoal} members has been reached!`);

      const stageEndTime = await startStageTimer(client, stage, stage.guildId, 10000);
      await sendLogMessage(client, `Stage will end at ${stageEndTime}.`);

      message = `Congratulations, the stage goal of ${stage.goals.memberCount} members has been reached! :dart:\n\n`;
      message = `${message}Great job, @everyone! :fire::fire::fire:\n\n`;
      message = `${message}Stage **${stage.id}** will end at **${stageEndTime.toUTCString()}**. Hurry up, you can still earn points until then!\n`;
    }
  }
  return message;
}

export async function startStageTimer(client, stage, guildId, timeout = 1000) {
  let stageEndTime;
  if (!stage.endTime) {
    stageEndTime = getStageEndTime();
    await db.updateStageEndTime(stage.id, guildId, stageEndTime.getTime());
    console.log(`Setting stage end time to ${stageEndTime}`);
  } else {
    stageEndTime = new Date(stage.endTime);
    console.log(`Stage end time is already set to ${stageEndTime}`);
  }

  startTimer(client, guildId, stageEndTime, stage, timeout);
  console.log(`Started timer for stage ${stage.id} and guild ${guildId}, ending at ${stageEndTime}`);
  return stageEndTime;
}

function startTimer(client, guildId, stageEndTime, stage, timeout) {
  if (timers[guildId]) {
    console.log(`Stage timer for guild ${guildId} is already running!`);
    return;
  }
  timers[guildId] = setTimeout(async () => {
    // Check if time is up
    const now = Date.now();
    const timeLeft = stageEndTime.getTime() - now;
    if (timeLeft <= 0) {
      console.log(`Stage ${stage.id} ended!`);
      clearTimeout(timers[guildId]);
      const nextStage = await switchStage(stage);

      // Send new stage announcement
      let message = `Big news, @everyone! Stage **${stage.id}** has ended and the results have been frozen.\n`;
      message = `${message}To check your final score use the **/rank previous** command.\n\n`;
      if (nextStage) {
        message = `${message}Not less important than that, a new stage **${nextStage.id}** has started, with the goal to reach **${nextStage.goals?.memberCount}** members. Good luck!\n`;
      }
      await sendInviteMessage(client, message);

      delete timers[guildId];
    } else {
      delete timers[guildId];
      startTimer(client, guildId, stageEndTime, stage, timeLeft > timeout ? timeout : timeLeft);
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