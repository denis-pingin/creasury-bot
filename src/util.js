import { config } from './config';

export function sendInviteMessage(client, message) {
  console.log(`Sending message to the invite channel: ${message}`);

  const channel = client.channels.cache.get(config.inviteChannelId);
  if (!channel) {
    console.log('Warning: invite channel not found');
  } else {
    channel.send(message);
  }
}

export function sendLogMessage(client, message) {
  console.log(`Sending message to the log channel: ${message}`);

  const channel = client.channels.cache.get(config.logChannelId);
  if (!channel) {
    console.log('Warning: log channel not found');
  } else {
    channel.send(message);
  }
}

export function getUserTag(user) {
  if (!user) return 'unknown user';
  return `<@${user.id}>`;
}
