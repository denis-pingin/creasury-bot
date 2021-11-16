import * as db from './db';
import { getUserTag } from './util';

export async function getMemberRanking(userId, stageId, guildId) {
  // Get stage rankings
  const stageRankings = await db.getStageRankings(stageId, guildId);
  if (stageRankings) {
    // Find member position
    const position = stageRankings.rankings.findIndex((user) => user.id === userId);
    if (position >= 0) {
      return stageRankings.rankings[position];
    }
  }
}

export async function getRankings(stageId, guildId) {
  const stageRankings = await db.getStageRankings(stageId, guildId);
  if (stageRankings) {
    return stageRankings;
  }
}

export async function getLeaderboard(stage, user, guildId) {
  console.log(`Getting leaderboard for stage "${stage.id}", user ${getUserTag(user)} and guild ${guildId}`);
  const rankings = await getRankings(stage.id, guildId);
  if (rankings) {
    const levels = {};

    const rankingTable = rankings.rankings;
    console.log('Rankings:', rankingTable);

    for (let level = 5; level > 0; level--) {

      // Level candidates
      const candidates = rankingTable.filter(member => member.points >= stage.levels[`${level}`].minPoints);
      // console.log(`Level ${level} candidates:`, candidates);

      let cutoffIndex, requiredPoints;
      switch (level) {
        case 5:
        case 4:
        case 3:
          if (candidates.length > 5 - level) {
            requiredPoints = candidates[5 - level].points;
            cutoffIndex = 5 - level;
          } else {
            requiredPoints = stage.levels[`${level}`].minPoints;
            cutoffIndex = -1;
          }
          break;
        case 2:
          cutoffIndex = Math.floor(candidates.length / 3);
          if (candidates.length > 3) {
            requiredPoints = candidates[cutoffIndex].points;
          } else {
            requiredPoints = stage.levels[`${level}`].minPoints;
          }
          break;
        case 1:
          cutoffIndex = candidates.length - 1;
          requiredPoints = stage.levels[`${level}`].minPoints;
          break;
      }
      levels[level] = { requiredPoints, cutoffIndex };
    }
    // console.log('Levels:', levels);


    let leaderboard = [];
    const includedIndexes = {};
    for (let i = 0; i < rankingTable.length; i++) {
      if (includedIndexes[i]) {
        continue;
      }

      if (rankingTable[i].id === user.id) {
        leaderboard.push({ type: 'spacer' });

        if (!includedIndexes[i - 1] && i > 1) {
          // Add previous to me
          leaderboard.push({ ...rankingTable[i - 1], type: 'member', me: rankingTable[i - 1].id === user.id });
          includedIndexes[i - 1] = true;
        }

        // Add me
        leaderboard.push({ ...rankingTable[i], type: 'member', me: rankingTable[i].id === user.id });
        includedIndexes[i] = true;

        if (!includedIndexes[i + 1] && i < rankingTable.length - 1) {
          // Add next to me
          leaderboard.push({ ...rankingTable[i + 1], type: 'member', me: rankingTable[i + 1].id === user.id });
          includedIndexes[i + 1] = true;
        }

        leaderboard.push({ type: 'spacer' });
      }

      for (let level = 5; level > 0; level--) {
        const levelData = levels[level];

        let added = false;
        if (levelData.cutoffIndex === i) {
          leaderboard.push({ type: 'spacer' });

          if (!includedIndexes[i]) {
            // Add level cutoff
            leaderboard.push({ ...rankingTable[i], type: 'member', me: rankingTable[i].id === user.id });
            includedIndexes[i] = true;
            added = true;
          }

          leaderboard.push({ type: 'spacer' });

          if (i < rankingTable.length - 1) {
            if (!includedIndexes[i + 1]) {
              leaderboard.push({ type: 'spacer' });

              // Add next to level cutoff (top of the lower level)
              leaderboard.push({ ...rankingTable[i + 1], type: 'member', me: rankingTable[i + 1].id === user.id });
              includedIndexes[i + 1] = true;
              added = true;

              leaderboard.push({ type: 'spacer' });
            }
          }
        }
        if (added) {
          break;
        }
      }
    }
    // console.log('Leaderboard:', leaderboard);

    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      if (entry.type === 'spacer') {
        // Delete spacer duplicates
        if (i > 0 && leaderboard[i - 1].type === 'spacer') {
          leaderboard[i - 1].delete = true;
        }
        continue;
      }

      // Go up and find the next non-spacer
      for (let j = i - 1; j > 0; j--) {
        const prevEntry = leaderboard[j];
        if (prevEntry.type === 'spacer') {
          continue;
        }

        // Current and previous are rank siblings
        if (entry.position - prevEntry.position === 1) {
          // Delete all spacer in between
          for (let k = j + 1; k < i; k++) {
            leaderboard[k].delete = true;
          }
        }
      }
    }
    // console.log('Marked leaderboard:', leaderboard);

    leaderboard = leaderboard.filter((entry, index) => {
      if (entry.delete ||
        (entry.type === 'spacer' && index === 0) ||
        (entry.type === 'spacer' && entry.position === rankingTable.length - 1)) {
        return false;
      }
      return true;
    });
    console.log('Leaderboard:', leaderboard);
    return leaderboard;
  } else {
    console.log(`Rankings for the stage ${stage.id} and guild ${guildId} not found`);
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
