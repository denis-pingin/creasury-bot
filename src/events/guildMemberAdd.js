import * as db from '../db';
import { getUserTag, sendInviteMessage, sendLogMessage } from '../util';
import { config } from '../config';
import { updateGlobalCounterAndLog } from '../globalCounterService';

export default async function handleGuildMemberAdd(client, member, inviter) {
  const fake = Date.now() - member.user.createdAt < 1000 * 60 * 60 * 24 * config.minAccountAge;

  const addMemberResult = await db.addMember(member, inviter, fake);

  if (addMemberResult.rejoin) {
    await updateGlobalCounterAndLog(client, 'rejoins', addMemberResult.member.user, member.guild.id, 1);
  }

  let message = `${getUserTag(member.user)} has ${addMemberResult.rejoin ? 're-' : ''}joined the Creasury community.\nThey were originally invited by `;
  if (addMemberResult.member.originalInviter) {
    if (fake) {
      await updateGlobalCounterAndLog(client, 'fakes', addMemberResult.member.originalInviter, member.guild.id, 1);
      message += `${getUserTag(addMemberResult.member.originalInviter)}, who unfortunately won't get any points because the minimum account age requirements weren't met` +
        ` (invited accounts must be older than ${config.minAccountAge} days).`;
    } else {
      const inviteCount = await updateGlobalCounterAndLog(client, 'invites', addMemberResult.member.originalInviter, member.guild.id, 1);
      message += `${getUserTag(addMemberResult.member.originalInviter)}, who just gained 1 point and now has ${inviteCount} ${inviteCount === 1 ? 'point' : 'points'} in total.`;
    }
  } else {
    message += 'some mysterious force, which some of us might want to investigate.';
  }

  sendLogMessage(client, message);
  sendInviteMessage(client, message);
}