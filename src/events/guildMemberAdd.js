import * as db from '../db';
import { getUserTag, sendInviteMessage, sendLogMessage } from '../util';

export default async function handleGuildMemberAdd(client, member, inviter) {
  const newMember = await db.addMember(member, inviter);

  let message = `${getUserTag(member.user)} has joined the Creasury community. They were originally invited by `;
  if (newMember.originalInviter) {
    const inviteCount = await db.incrementGlobalInvites(newMember.originalInviter, member.guild.id);
    message += `${getUserTag(newMember.originalInviter)}, who just gained 1 point and now has ${inviteCount} ${inviteCount === 1 ? 'point' : 'points'} in total.`;
  } else {
    message += 'some mysterious force, which some of us might want to investigate.';
  }

  sendLogMessage(client, message);
  sendInviteMessage(client, message);
}