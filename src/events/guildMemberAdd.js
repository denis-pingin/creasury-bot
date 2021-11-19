import * as db from '../db';
import { getInviterTag, getUserTag, sendInviteMessage, sendLogMessage } from '../util';
import { config } from '../config';
import { updateGlobalCounterAndLog } from '../counters';
import { handleGlobalPoints, handleStagePoints } from '../scoring';
import { computeRankings } from '../ranking';
import { checkStageGoal } from '../stage';
import * as guild from '../guild';

export default async function handleGuildMemberAdd(client, member, inviter) {
  const fake = Date.now() - member.user.createdAt < 1000 * 60 * 60 * 24 * config.minAccountAge;

  // Get guild config
  const guildConfig = await db.getConfig(member.guild.id);

  // Add member
  const addMemberResult = await db.addMember(member, inviter, fake);

  // Create event
  const eventTimestamp = await db.addJoinEvent(member, inviter, addMemberResult.member.originalInviter, fake);

  // Count re-joins
  if (addMemberResult.rejoin) {
    await updateGlobalCounterAndLog(client, 'rejoins', addMemberResult.member.user, member.guild.id, 1);
  }

  // Build the first part of the message
  let message = buildJoinMessage(member, addMemberResult);

  // Update global counters
  await handleGlobalPoints(client, addMemberResult);

  // Check if there is an active stage
  const stage = await db.getActiveStage(member.guild.id);
  if (stage) {
    // Update stage counters
    const stageMessage = await handleStagePoints(guildConfig, stage, client, addMemberResult);

    // Get members for ranking
    const members = await guild.getMembers(member.guild, guildConfig);
    // logObject('Members for ranking:', members);

    // Compute rankings
    await computeRankings(members, stage, member.guild.id);

    // Add current stage points of the original inviter to the join event
    if (addMemberResult.member.originalInviter) {
      const stagePoints = await db.getStagePoints(addMemberResult.member.originalInviter.id, member.guild.id);
      await db.updateJoinEvent(member.user.id, eventTimestamp, stagePoints);
    }

    // Append stage message
    message = `${message}\n${stageMessage}`;

    // Check stage goal
    const stageGoalMessage = await checkStageGoal(client, stage, members);

    // Append stage goal message
    message = `${message}\n${stageGoalMessage ? stageGoalMessage : ''}`;
  } else {
    await sendLogMessage(client, 'No active stage found, won\'t award any stage points.');
  }

  // Send invite message
  await sendInviteMessage(client, message);
}

function buildJoinMessage(member, addMemberResult) {
  let message;
  if (addMemberResult.rejoin) {
    // Re-join
    message = `${getUserTag(member.user)} has re-joined the Creasury community, welcome back! :tada:\n`;
    message = `${message}They were invited by ${getInviterTag(addMemberResult.member.inviter)}.\n`;
    if (addMemberResult.member.inviter?.id !== addMemberResult.member.originalInviter?.id) {
      // Re-join from a different inviter
      message = `${message}They were **originally** invited by ${getInviterTag(addMemberResult.member.originalInviter)}.\n`;
    }
  } else {
    // First time join
    message = `${getUserTag(member.user)} has joined the Creasury community! :tada::tada::tada:\n`;
    message = `${message}They were invited by ${getInviterTag(addMemberResult.member.originalInviter)}, who is a hero! :trophy:\n`;
  }
  return message;
}
