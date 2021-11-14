import * as db from '../db';
import { getInviterTag, getUserTag, sendInviteMessage, sendLogMessage } from '../util';
import { updateGlobalCounterAndLog, updateStageCounterAndLog } from '../globalCounterService';
import { config } from '../config';

export default async function handleGuildMemberRemove(client, member) {
  const removeMemberResult = await db.removeMember(member);

  await handleGlobalPoints(client, removeMemberResult);
  const stageMessage = await handleStagePoints(client, removeMemberResult);

  let message = `${getUserTag(member.user)} has left the Creasury community. :pensive:`;
  message = `${message}\nThey were originally invited by ${getInviterTag(removeMemberResult.member.originalInviter)}.`;

  sendInviteMessage(client, `${message}\n${stageMessage}`);
}

async function handleGlobalPoints(client, removeMemberResult) {
  const originalInviter = removeMemberResult.member.originalInviter;
  if (originalInviter) {
    if (!removeMemberResult.member.fake) {
      await updateGlobalCounterAndLog(client, 'regularLeaves', originalInviter, removeMemberResult.member.guildId, 1);
      await updateGlobalCounterAndLog(client, 'totalInvites', originalInviter, removeMemberResult.member.guildId, -1);
    } else {
      await updateGlobalCounterAndLog(client, 'fakeLeaves', originalInviter, removeMemberResult.member.guildId, 1);
    }
  } else {
    sendLogMessage(client, `Original inviter of member ${getUserTag(removeMemberResult.member.user)} is unknown, won't update global points.`);
  }
}

async function handleStagePoints(client, removeMemberResult) {
  let message = '';
  const stage = await db.getActiveStage();
  if (!stage) {
    sendLogMessage(client, 'No active stage found, won\'t update stage points.');
  } else {
    const originalInviter = removeMemberResult.member.originalInviter;
    if (originalInviter) {
      const originalInviteTimestamp = removeMemberResult.member.originalInviteTimestamp;
      if (removeMemberResult.member.fake) {
        await updateStageCounterAndLog(client, stage.id, 'fakeLeaves', originalInviter, removeMemberResult.member.guildId, 1);
        message = `Minimum account age requirements weren't met (> ${config.minAccountAge} days), won't update stage points.`;
      } else if (originalInviteTimestamp < stage.startedAt) {
        sendLogMessage(client, `${getUserTag(removeMemberResult.member.user)} originally joined before the current stage has started, won't update stage points.`);
        message = `${getUserTag(removeMemberResult.member.user)} originally joined before the current stage has started, won't update stage points.`;
      } else {
        const points = await updateStageCounterAndLog(client, stage.id, 'points', originalInviter, removeMemberResult.member.guildId, -1);
        message = `${getUserTag(removeMemberResult.member.originalInviter)} just lost 1 point and now has ${points} ${points === 1 ? 'point' : 'points'} in total.`;
      }
    } else {
      sendLogMessage(client, `Original inviter of member ${getUserTag(removeMemberResult.member.user)} is unknown, won't update stage points.`);
      message = `Original inviter of member ${getUserTag(removeMemberResult.member.user)} is unknown, won't update stage points.`;
    }
  }
  return message;
}