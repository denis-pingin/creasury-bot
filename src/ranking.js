import * as db from './db';

export async function getMemberRanking(userId, stageId, guildId) {
  // Get stage rankings
  const stageRankings = await db.getStageRankings(stageId, guildId);
  if (stageRankings) {
    // Find member position
    const position = stageRankings.rankings.findIndex((user) => user.id === userId);
    if (position >= 0) {
      // Get member rank
      return { ...stageRankings.rankings[position], position: position + 1 };
    }
  }
}

export async function computeRankings(members, stage, guildId) {
  console.log('Starting computing rankings...');
  const startTime = Date.now();

  const database = await db.getDatabase();

  let memberPoints = await Promise.all(members
    .filter(member => !member.user.bot)
    .map(async member => {
      const result = await database.collection('memberCounters').findOne({ id: member.user.id, guildId: guildId }, { projection: { [`${stage.id}.points`]: true } });
      const points = result ? result[stage.id] ? result[stage.id].points | 0 : 0 : 0;
      return {
        id: member.user.id,
        points: points,
      };
    }));
  memberPoints = memberPoints.sort((a, b) => a.points > b.points ? -1 : 1);
  // console.log('Member points', memberPoints);

  const l2Candidates = memberPoints.filter(val => val.points >= stage.levels['2'].minPoints);
  // console.log('Level 2 candidates', l2Candidates);

  const l2CutoffIndex = Math.floor(l2Candidates.length / 3);
  // console.log('Level 2 cutoff index', l2CutoffIndex);

  memberPoints = await sortMembers(memberPoints);
  // console.log('Sorted members', memberPoints);

  const rankings = [];
  for (let i = 0; i < memberPoints.length; i++) {
    rankings.push({
      id: memberPoints[i].id,
      points: memberPoints[i].points,
      level: getLevel(memberPoints, i, stage.levels, l2CutoffIndex),
      timestamp: memberPoints[i].timestamp,
      position: i + 1,
    });
  }
  // console.log('Rankings', rankings);

  await db.updateStageRankings(stage, rankings, guildId);

  const endTime = Date.now();
  console.log(`Finished computing rankings in ${endTime - startTime} ms.`);
}

async function sortMembers(memberPoints) {
  // Fetch timestamps for members with equal points
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
  // console.log('Fetched timestamps', memberPoints);

  // Sort members based on points and timestamps
  return memberPoints.sort((a, b) => {
    if (a.points < b.points) {
      return 1;
    } else if (a.points > b.points) {
      return -1;
    } else {
      // Determine winner by timestamp
      return a.timestamp < b.timestamp ? -1 : 1;
    }
  });
}

function getLevel(memberPoints, index, levels, cutoffIndex) {
  if (memberPoints[index].points >= levels['5'].minPoints && index === 0) {
    return 5;
  } else if (memberPoints[index].points >= levels['4'].minPoints && index === 1) {
    return 4;
  } else if (memberPoints[index].points >= levels['3'].minPoints && index === 2) {
    return 3;
  } else if (memberPoints[index].points >= levels['2'].minPoints && index <= cutoffIndex) {
    return 2;
  } else if (memberPoints[index].points >= levels['1'].minPoints) {
    return 1;
  }
}
