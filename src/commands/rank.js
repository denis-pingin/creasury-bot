import { SlashCommandBuilder } from '@discordjs/builders';
import * as db from '../db';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Checks your current stage rank'),
  async execute(interaction) {
    const stage = await db.getActiveStage();
    let message = '';
    if (!stage) {
      message = 'Currently there is no active event happening.';
    } else {
      const members = await interaction.guild.members.fetch();
      console.log(`Active stage is "${stage.id}" with levels:`, stage.levels);
      const rankings = await computeRankings(members, stage, interaction.guildId);
      const rank = rankings[interaction.user.id];
      if (!rank) {
        message = 'Unfortunately your rank could not be determined.';
      } else if (rank.level) {
        message = `You currently have ${rank.points} points and level ${rank.level}.`;
      } else {
        message = `You currently have ${rank.points} points and have not yet reached any level.`;
      }
    }
    await interaction.reply(message);
  },
};

async function computeRankings(members, stage, guildId) {
  const database = await db.getDatabase();

  let memberPoints = await Promise.all(members.map(async member => {
    const result = await database.collection('memberCounters').findOne({ id: member.user.id, guildId: guildId }, { projection: { [`${stage.id}.points`]: true } });
    const points = result ? result[stage.id] ? result[stage.id].points | 0 : 0 : 0;
    return {
      id: member.user.id,
      points: points,
    };
  }));

  console.log('Member points', memberPoints);

  const l2Candidates = memberPoints.filter(val => val.points >= stage.levels['2'].minPoints);
  console.log('Level 2 candidates', l2Candidates);
  const l2CutoffIndex = Math.floor(l2Candidates.length / 3);
  console.log('Level 2 cutoff index', l2CutoffIndex);

  memberPoints = await sortMembers(memberPoints);
  console.log('Sorted members', memberPoints);

  let rankings = [];
  for (let i = 0; i < memberPoints.length; i++) {
    rankings.push({
      id: memberPoints[i].id,
      points: memberPoints[i].points,
      level: getLevel(memberPoints, i, stage.levels, l2CutoffIndex),
    });
  }
  rankings = rankings.reduce((prev, cur) => {
    prev[cur.id] = cur;
    return prev;
  }, {});
  console.log('Rankings', rankings);
  return rankings;
}

async function sortMembers(memberPoints) {
  // Starting with the second one
  for (let i = 0; i < memberPoints.length; i++) {
    const cur = memberPoints[i];
    if (i < memberPoints.length - 1) {
      const next = memberPoints[i + 1];
      if (cur.points === next.points) {
        cur.timestamp = await db.getLastTimeReachedThisScore(cur.id, cur.points);
      } else if (i > 0) {
        // If next has less but prev has the same, fetch for cur
        const prev = memberPoints[i - 1];
        if (cur.points === prev.points) {
          cur.timestamp = await db.getLastTimeReachedThisScore(cur.id, cur.points);
        }
      }
    } else if (i > 0) {
      // If last one has the same as prev, fetch for cur
      const prev = memberPoints[i - 1];
      if (cur.points === prev.points) {
        cur.timestamp = await db.getLastTimeReachedThisScore(cur.id, cur.points);
      }
    }
  }
  console.log('Fetched timestamps', memberPoints);

  return memberPoints.sort((a, b) => {
    if (a.points < b.points) {
      return 1;
    } else if (a.points > b.points) {
      return -1;
    } else {
      return a.timestamp < b.timestamp ? -1 : 1;
    }
  });
}

function getLevel(memberPoints, index, levels, cutoffIndex) {
  if (memberPoints[index].points >= levels['3'].minPoints) {
    if (index < 3) {
      return 3;
    }
  }
  if (memberPoints[index].points >= levels['2'].minPoints) {
    if (index <= cutoffIndex) {
      return 2;
    }
  }
  if (memberPoints[index].points >= levels['1'].minPoints) {
    return 1;
  }
}

