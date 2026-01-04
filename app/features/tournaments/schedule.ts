export function generateRoundRobinPairs(teamIds: string[]) {
  const ids = teamIds.filter(Boolean);
  const pairs: Array<{ team1Id: string; team2Id: string }> = [];

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push({ team1Id: ids[i]!, team2Id: ids[j]! });
    }
  }

  return pairs;
}


