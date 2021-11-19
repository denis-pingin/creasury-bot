import { updateGlobalCounterAndLog, updateStageCounterAndLog } from './counters';
import { getUserTag, sendLogMessage } from './util';
import { config } from './config';
import * as guild from './guild';

export async function handleGlobalPoints(client, addMemberResult) {
  const originalInviter = addMemberResult.member.originalInviter;
  if (originalInviter) {
    if (addMemberResult.member.fake) {
      await updateGlobalCounterAndLog(client, 'fakeInvites', originalInviter, addMemberResult.member.guildId, 1);
    } else {
      await updateGlobalCounterAndLog(client, 'regularInvites', originalInviter, addMemberResult.member.guildId, 1);
      await updateGlobalCounterAndLog(client, 'totalInvites', originalInviter, addMemberResult.member.guildId, 1);
    }
  } else {
    await sendLogMessage(client, `Original inviter of member ${getUserTag(addMemberResult.member.user)} is unknown, no global points will be awarded.`);
  }
}

export async function handleStagePoints(guildConfig, stage, client, addMemberResult) {
  let message = '';
  const originalInviter = addMemberResult.member.originalInviter;
  if (originalInviter) {
    // Check if the original inviter is excluded from ranking in the guild config
    const excluded = guild.excludedFromRanking(originalInviter.id, guildConfig);

    if (addMemberResult.member.fake) {
      await updateStageCounterAndLog(client, stage.id, 'fakeInvites', originalInviter, addMemberResult.member.guildId, 1);
      if (!excluded) {
        message = `Minimum account age requirements weren't met (> ${config.minAccountAge} days), ${getUserTag(addMemberResult.member.originalInviter)} won't be awarded any points.\n`;
      }
    } else if (addMemberResult.rejoin) {
      const originalInviteTimestamp = addMemberResult.member.originalInviteTimestamp;
      if (originalInviteTimestamp < stage.startedAt) {
        await sendLogMessage(client, `${getUserTag(addMemberResult.member.user)} originally joined before the current stage has started, no points will be awarded.`);
        if (!excluded) {
          message = `${getUserTag(addMemberResult.member.user)} originally joined before the current stage has started, ${getUserTag(addMemberResult.member.originalInviter)} won't be awarded any points.\n`;
        }
      } else {
        const points = await updateStageCounterAndLog(client, stage.id, 'points', originalInviter, addMemberResult.member.guildId, 1);
        if (!excluded) {
          message = `${getUserTag(addMemberResult.member.originalInviter)} just gained 1 point and now has ${points} ${points === 1 ? 'point' : 'points'} in total.\n`;
        }
      }
    } else {
      const points = await updateStageCounterAndLog(client, stage.id, 'points', originalInviter, addMemberResult.member.guildId, 1);
      if (!excluded) {
        message = `${getUserTag(addMemberResult.member.originalInviter)} just gained 1 point and now has ${points} ${points === 1 ? 'point' : 'points'} in total.\n`;
      }
    }
  } else {
    await sendLogMessage(client, `Original inviter of member ${getUserTag(addMemberResult.member.user)} is unknown, no stage points will be awarded.`);
    message = `Original inviter of member ${getUserTag(addMemberResult.member.user)} is unknown, no points will be awarded.\n`;
  }
  return message;
}