import * as db from '../db';
import { getUserTag, sendInviteMessage, sendLogMessage } from '../util';
import { updateGlobalCounterAndLog } from '../globalCounterService';

export default async function handleGuildMemberRemove(client, member) {
  const removedMember = await db.removeMember(member);

  let message = `${getUserTag(member.user)} has left the Creasury community. They were originally invited by `;

  const originalInviter = await db.getOriginalInviter(member);
  if (originalInviter) {
    if (removedMember.member.fake) {
      await updateGlobalCounterAndLog(client, 'fakes', originalInviter, member.guild.id, -1);
      message += `${getUserTag(originalInviter)}, who won't loose any points because they didn't get any points for this invite in the first place (the minimum account age requirements weren't originally met).`;
    } else {
      const inviteCount = await updateGlobalCounterAndLog(client, 'invites', originalInviter, member.guild.id, -1);
      message += `${getUserTag(originalInviter)}, who just lost 1 point and now has ${inviteCount} ${inviteCount === 1 ? 'point' : 'points'} in total.`;
    }
  } else {
    message += 'some mysterious force, which some of us might want to investigate.';
  }

  sendLogMessage(client, message);
  sendInviteMessage(client, message);
}