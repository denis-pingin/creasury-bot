import * as db from '../db';
import { getUserTag, sendInviteMessage, sendLogMessage } from '../util';

export default async function handleGuildMemberRemove(client, member) {
  db.removeMember(member);

  let message = `${getUserTag(member.user)} has left the Creasury community. They were originally invited by `;

  const originalInviter = await db.getOriginalInviter(member);
  if (originalInviter) {
    const inviteCount = await db.decrementGlobalInvites(originalInviter, member.guild.id);
    message += `${getUserTag(originalInviter)}, who just lost 1 point and now has ${inviteCount} ${inviteCount === 1 ? 'point' : 'points'} in total.`;
  } else {
    message += 'some mysterious force, which some of us might want to investigate.';
  }

  sendLogMessage(client, message);
  sendInviteMessage(client, message);
}