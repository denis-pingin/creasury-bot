import { config } from './config';

export async function sendInviteMessage(client, message) {
  console.log(`#invites: ${message}`);

  if (!client) return;

  const channel = client.channels.cache.get(config.inviteChannelId);
  if (!channel) {
    console.log('Warning: invite channel not found');
  } else {
    await channel.send(message);
  }
}

export async function sendLogMessage(client, message) {
  console.log(`#log: ${message}`);

  if (!client) return;

  const channel = client.channels.cache.get(config.logChannelId);
  if (!channel) {
    console.log('Warning: log channel not found');
  } else {
    await channel.send(message);
  }
}

export function getInviterTag(user) {
  if (!user) return 'some mysterious force';
  return getUserTag(user);
}

export function getUserTag(user) {
  if (!user) return 'unknown user';
  return `<@${user.id}>`;
}
