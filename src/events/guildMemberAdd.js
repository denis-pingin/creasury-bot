import * as db from '../db';
import { getInviterTag, getUserTag, sendInviteMessage, sendLogMessage } from '../util';
import { updateGlobalCounterAndLog } from '../counters';
import { handleGlobalPoints, handleStagePoints } from '../scoring';
import { computeRankings } from '../ranking';
import { checkStageGoal } from '../stage';
import * as guild from '../guild';

export default async function handleGuildMemberAdd(client, event) {
  // Get guild config
  const guildConfig = await db.getConfig(event.guildId);

  // Add member
  const addMemberResult = await db.addMember(event.user, event.inviter, event.fake, event.guildId);

  // Count re-joins
  if (addMemberResult.rejoin) {
    await updateGlobalCounterAndLog(client, 'rejoins', addMemberResult.member.user, event.guildId, 1);
  }

  // Build the first part of the message
  let message = buildJoinMessage(event.user, addMemberResult);

  // Update global counters
  await handleGlobalPoints(client, addMemberResult);

  // Check if there is an active stage
  const stage = await db.getActiveStage(event.guildId);
  let stagePoints;
  if (stage) {
    // Update stage counters
    const stageMessage = await handleStagePoints(guildConfig, stage, client, addMemberResult);

    // Append stage message
    message = `${message}\n${stageMessage}`;

    // Add current stage points of the original inviter to the join event
    if (addMemberResult.member.originalInviter) {
      stagePoints = await db.getStagePoints(addMemberResult.member.originalInviter.id, event.guildId);
    }
  } else {
    await sendLogMessage(client, 'No active stage found, won\'t award stage points.');
  }

  // Update join event
  await db.updateJoinEvent(event, stagePoints, addMemberResult.member.originalInviter);

  if (stage) {
    // Get members for ranking
    const members = await guild.getMembers(client.guilds.cache.get(event.guildId), guildConfig);
    // logObject('Members for ranking:', members);

    // Compute rankings
    await computeRankings(members, stage, event.guildId);

    // Check stage goal
    const stageGoalMessage = await checkStageGoal(client, stage, members);

    // Append stage goal message
    message = `${message}\n${stageGoalMessage ? stageGoalMessage : ''}`;
  }

  // Send invite message
  await sendInviteMessage(client, message);
}

function buildJoinMessage(user, addMemberResult) {
  let message;
  if (addMemberResult.rejoin) {
    // Re-join
    message = `${getUserTag(user)} has re-joined the Creasury community, welcome back! :tada:\n`;
    message = `${message}They were invited by ${getInviterTag(addMemberResult.member.inviter)}.\n`;
    if (addMemberResult.member.inviter?.id !== addMemberResult.member.originalInviter?.id) {
      // Re-join from a different inviter
      message = `${message}They were **originally** invited by ${getInviterTag(addMemberResult.member.originalInviter)}.\n`;
    }
  } else {
    // First time join
    message = `${getUserTag(user)} has joined the Creasury community! :tada::tada::tada:\n`;
    message = `${message}They were invited by ${getInviterTag(addMemberResult.member.originalInviter)}${addMemberResult.member.originalInviter ? ', who is a hero! :trophy:' : ''}\n`;
  }
  return message;
}
