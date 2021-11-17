import * as db from '../db';
import { getInviterTag, getUserTag, sendInviteMessage, sendLogMessage } from '../util';
import { config } from '../config';
import { updateGlobalCounterAndLog } from '../counters';
import { handleGlobalPoints, handleStagePoints } from '../scoring';
import { computeRankings } from '../ranking';
import { startStageTimer } from '../stage';

export default async function handleGuildMemberAdd(client, member, inviter) {
  const fake = Date.now() - member.user.createdAt < 1000 * 60 * 60 * 24 * config.minAccountAge;

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
  if (!stage) {
    await sendLogMessage(client, 'No active stage found, won\'t award any stage points.');
  } else {
    // Update stage counters
    const stageMessage = await handleStagePoints(stage, client, addMemberResult);

    // Compute rankings
    const members = await member.guild.members.fetch();
    await computeRankings(members, stage, member.guild.id);

    // Add current stage points of the original inviter to the join event
    if (addMemberResult.member.originalInviter) {
      const stagePoints = await db.getStagePoints(addMemberResult.member.originalInviter.id, member.guild.id);
      await db.updateJoinEvent(member.user.id, eventTimestamp, stagePoints);
    }

    // Append stage message
    message = `${message}\n${stageMessage}`;

    // Member count goal
    const memberCount = member.guild.memberCount;
    const memberGoal = stage.goal?.memberCount;
    if (!stage.endTime && memberGoal) {
      let stageGoalMessage;
      if (memberCount >= memberGoal) {
        const stageEndTime = await startStageTimer(stage, member.guild.id, 1000);

        stageGoalMessage = `Congratulations, the stage goal of ${stage.goal.memberCount} members has been reached!\n`;
        stageGoalMessage = `${stageGoalMessage}Stage **${stage.id}** will end at **${stageEndTime.toUTCString()}**. Hurry up, you can still earn points until then!\n`;
      } else {
        stageGoalMessage = `Still ${stage.goal.memberCount} ${stage.goal.memberCount === 1 ? 'member' : 'members'} to go to reach the stage goal!\n`;
      }

      // Append goal reached
      message = `${message}\n\n${stageGoalMessage}\n`;
    }
  }

  // Send invite message
  await sendInviteMessage(client, message);
}

function buildJoinMessage(member, addMemberResult) {
  let message = `${getUserTag(member.user)} has ${addMemberResult.rejoin ? 're-' : ''}joined the Creasury community! :tada:\n`;
  if (addMemberResult.rejoin) {
    // Re-join
    message = `${message}They were invited by ${getInviterTag(addMemberResult.member.inviter)}.\n`;
    if (addMemberResult.member.inviter?.id !== addMemberResult.member.originalInviter?.id) {
      // Re-join from a different inviter
      message = `${message}They were **originally** invited by ${getInviterTag(addMemberResult.member.originalInviter)}.\n`;
    }
  } else {
    // First time join
    message = `${message}They were invited by ${getInviterTag(addMemberResult.member.originalInviter)}.\n`;
  }
  return message;
}
