import { getUserTag, logObject } from './util';
import { config } from './config';

export async function handleInviteCreate(invite) {
  const invites = await invite.guild.invites.fetch();

  const codeUses = new Map();
  invites.each(inv => codeUses.set(inv.code, inv.uses));

  guildInvites.set(invite.guild.id, codeUses);
}


const guildInvites = new Map();

export function init(client) {
  client.guilds.cache
    .filter(guild => guild.id === config.guildId)
    .forEach(guild => {
      guild.invites.fetch()
        .then(invites => {
          const codeUses = new Map();
          invites.each(inv => codeUses.set(inv.code, inv.uses));

          guildInvites.set(guild.id, codeUses);
          console.log('Invites cached.');
        })
        .catch(err => {
          logObject('OnReady error:', err);
        });
    });
}

export async function handleJoin(member) {
  const cachedInvites = guildInvites.get(member.guild.id);
  const newInvites = await member.guild.invites.fetch();

  const usedInvite = newInvites.find(inv => cachedInvites.get(inv.code) < inv.uses);
  if (!usedInvite) {
    console.warn(`Inviter for member ${getUserTag(member.user)} could not be determined`, [...newInvites.values()].map(inv => inv.code), [...cachedInvites.keys()]);
  }

  newInvites.each(inv => cachedInvites.set(inv.code, inv.uses));
  guildInvites.set(member.guild.id, cachedInvites);

  return usedInvite?.inviter;
}