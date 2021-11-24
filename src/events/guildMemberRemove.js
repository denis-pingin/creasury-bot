import * as db from '../db';
import { getInviterTag, getUserTag, sendInviteMessage, sendLogMessage } from '../util';
import { updateGlobalCounterAndLog, updateStageCounterAndLog } from '../counters';
import * as guild from '../guild';
import { computeRankings } from '../ranking';

export default async function handleGuildMemberRemove(client, event) {
  // Get guild config
  const guildConfig = await guild.getGuildConfig(event.guildId);
  // logObject('Guild config:', guildConfig);

  // Remove member
  const removeMemberResult = await db.removeMember(event.user, event.guildId);

  // Handle global points
  await handleGlobalPoints(client, removeMemberResult);


  // Build the first part of the message
  let message = `${getUserTag(event.user)} has left the Creasury community. :pensive:\n`;
  message = `${message}They were originally invited by ${getInviterTag(removeMemberResult.member.originalInviter)}.\n`;

  // Check if there is an active stage
  const stage = await db.getActiveStage(removeMemberResult.member.guildId);
  if (stage) {
    const stageMessage = await handleStagePoints(guildConfig, client, stage, removeMemberResult);

    // Get members for ranking
    const members = await guild.getMembers(client.guilds.cache.get(event.guildId), guildConfig);
    // logObject('Members for ranking:', members);

    // Compute rankings
    await computeRankings(members, stage, event.guildId);

    // Append stage message
    message = `${message}\n${stageMessage}`;
  } else {
    await sendLogMessage(client, event.guildId, 'No active stage found, won\'t update stage points.');
  }
  await db.updateLeaveEvent(event);

  await sendInviteMessage(client, event.guildId, message);
}

async function handleGlobalPoints(client, removeMemberResult) {
  const originalInviter = removeMemberResult.member.originalInviter;
  const guildId = removeMemberResult.member.guildId;
  if (originalInviter) {
    if (!removeMemberResult.member.fake) {
      await updateGlobalCounterAndLog(client, 'regularLeaves', originalInviter, guildId, 1);
      await updateGlobalCounterAndLog(client, 'totalInvites', originalInviter, guildId, -1);
    } else {
      await updateGlobalCounterAndLog(client, 'fakeLeaves', originalInviter, guildId, 1);
    }
  } else {
    await sendLogMessage(client, guildId, `Original inviter of member ${getUserTag(removeMemberResult.member.user)} is unknown, won't update global points.`);
  }
}

async function handleStagePoints(guildConfig, client, stage, removeMemberResult) {
  let message = '';
  const originalInviter = removeMemberResult.member.originalInviter;
  const guildId = removeMemberResult.member.guildId;
  if (originalInviter) {
    const excluded = guild.excludedFromRanking(originalInviter.id, guildConfig);

    const originalInviteTimestamp = removeMemberResult.member.originalInviteTimestamp;
    if (removeMemberResult.member.fake) {
      await updateStageCounterAndLog(client, stage.id, 'fakeLeaves', originalInviter, guildId, 1);
      if (!excluded) {
        message = `Minimum account age requirements weren't met (> ${guildConfig.minAccountAge * 24} hours), won't update stage points.`;
      }
    } else if (originalInviteTimestamp < stage.startedAt) {
      await sendLogMessage(client, guildId, `${getUserTag(removeMemberResult.member.user)} originally joined before the current stage has started, won't update stage points.`);
      if (!excluded) {
        message = `${getUserTag(removeMemberResult.member.user)} originally joined before the current stage has started, won't update stage points.`;
      }
    } else {
      const points = await updateStageCounterAndLog(client, stage.id, 'points', originalInviter, guildId, -1);
      if (!excluded) {
        message = `${getUserTag(removeMemberResult.member.originalInviter)} just lost 1 point and now has ${points} ${points === 1 ? 'point' : 'points'} in total.`;
      }
    }
  } else {
    await sendLogMessage(client, guildId, `Original inviter of member ${getUserTag(removeMemberResult.member.user)} is unknown, won't update stage points.`);
    message = `Original inviter of member ${getUserTag(removeMemberResult.member.user)} is unknown, won't update stage points.`;
  }
  return message;
}