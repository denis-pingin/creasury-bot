import * as db from '../db';
import { getInviterTag, getUserTag, sendInviteMessage, sendLogMessage } from '../util';
import { config } from '../config';
import { updateGlobalCounterAndLog, updateStageCounterAndLog } from '../globalCounterService';

export default async function handleGuildMemberAdd(client, member, inviter) {
  const fake = Date.now() - member.user.createdAt < 1000 * 60 * 60 * 24 * config.minAccountAge;

  const addMemberResult = await db.addMember(member, inviter, fake);

  if (addMemberResult.rejoin) {
    await updateGlobalCounterAndLog(client, 'rejoins', addMemberResult.member.user, member.guild.id, 1);
  }

  await handleGlobalPoints(client, addMemberResult);
  const stageMessage = await handleStagePoints(client, addMemberResult);

  let message = `${getUserTag(member.user)} has ${addMemberResult.rejoin ? 're-' : ''}joined the Creasury community.`;
  message = `${message}\nThey were originally invited by ${getInviterTag(addMemberResult.member.originalInviter)}`;
  if (addMemberResult.rejoin && addMemberResult.member.inviter.id !== addMemberResult.member.originalInviter.id) {
    message = `${message} and now invited by ${getInviterTag(addMemberResult.member.inviter)}`;
  }
  message = `${message}.`;

  sendInviteMessage(client, `${message}\n${stageMessage}`);
}

async function handleGlobalPoints(client, addMemberResult) {
  const originalInviter = addMemberResult.member.originalInviter;
  if (originalInviter) {
    if (!addMemberResult.member.fake) {
      await updateGlobalCounterAndLog(client, 'points', originalInviter, addMemberResult.member.guildId, 1);
    } else {
      await updateGlobalCounterAndLog(client, 'fakes', originalInviter, addMemberResult.member.guildId, 1);
    }
  } else {
    sendLogMessage(client, `Inviter of user ${getUserTag(addMemberResult.member.user)} is unknown, no global points will be awarded.`);
  }
}

async function handleStagePoints(client, addMemberResult) {
  let message = '';
  const stage = await db.getActiveStage();
  if (!stage) {
    sendLogMessage(client, 'No active stage found, won\'t award any stage points.');
  } else {
    const originalInviter = addMemberResult.member.originalInviter;
    if (originalInviter) {
      if (addMemberResult.member.fake) {
        await updateStageCounterAndLog(client, stage.id, 'fakes', originalInviter, addMemberResult.member.guildId, 1);
        message = `Minimum account age requirements weren't met (> ${config.minAccountAge} days), ${getUserTag(addMemberResult.member.originalInviter)} won't be awarded any points.`;
      } else if (addMemberResult.rejoin) {
        const originalInviteTimestamp = addMemberResult.member.originalInviteTimestamp;
        if (originalInviteTimestamp < stage.startedAt) {
          sendLogMessage(client, `User ${getUserTag(addMemberResult.member.user)} re-joined, they originally joined before the current stage started, no points will be awarded.`);
          message = `${getUserTag(addMemberResult.member.user)} originally joined before the current stage has started, ${getUserTag(addMemberResult.member.originalInviter)} won't be awarded any points.`;
        } else {
          const points = await updateStageCounterAndLog(client, stage.id, 'points', originalInviter, addMemberResult.member.guildId, 1);
          message = `${getUserTag(addMemberResult.member.originalInviter)} just gained 1 point and now has ${points} ${points === 1 ? 'point' : 'points'} in total.`;
        }
      } else {
        const points = await updateStageCounterAndLog(client, stage.id, 'points', originalInviter, addMemberResult.member.guildId, 1);
        message = `${getUserTag(addMemberResult.member.originalInviter)} just gained 1 point and now has ${points} ${points === 1 ? 'point' : 'points'} in total.`;
      }
    } else {
      sendLogMessage(client, `Original inviter of user ${getUserTag(addMemberResult.member.user)} is unknown, no stage points will be awarded.`);
      message = `Original inviter of user ${getUserTag(addMemberResult.member.user)} is unknown, no points will be awarded.`;
    }
  }
  return message;
}