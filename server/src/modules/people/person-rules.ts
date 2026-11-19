import type { Rank } from '@spoh/shared';

export interface RoleFields {
  rank: Rank;
  team: string | null;
  portfolio: string | null;
}

export interface RoleLists {
  teams: readonly string[];
  portfolios: readonly string[];
}

export interface RuleViolation {
  field: 'team' | 'portfolio';
  message: string;
}

/**
 * Which of team / portfolio each rank needs. Shared by single edits and CSV import so
 * both paths enforce exactly the same rules.
 *  - Volunteer, IC: a team from the configured list; no portfolio.
 *  - Deputy: a portfolio they lead; no team.
 *  - Shadow IC: the portfolio they shadow, or "CC"; no team.
 *  - CC: neither.
 */
export function checkRoleFields(p: RoleFields, lists: RoleLists): RuleViolation[] {
  const problems: RuleViolation[] = [];
  const needsTeam = p.rank === 'volunteer' || p.rank === 'ic';
  const needsPortfolio = p.rank === 'deputy' || p.rank === 'shadow_ic';

  if (needsTeam) {
    if (!p.team) problems.push({ field: 'team', message: 'A team is required.' });
    else if (!lists.teams.includes(p.team)) {
      problems.push({ field: 'team', message: `"${p.team}" is not one of the configured teams.` });
    }
  } else if (p.team) {
    problems.push({ field: 'team', message: 'Only ICs and volunteers belong to a team.' });
  }

  if (needsPortfolio) {
    const allowed = p.rank === 'shadow_ic' ? [...lists.portfolios, 'CC'] : lists.portfolios;
    if (!p.portfolio) problems.push({ field: 'portfolio', message: 'A portfolio is required.' });
    else if (!allowed.includes(p.portfolio)) {
      problems.push({
        field: 'portfolio',
        message: `"${p.portfolio}" is not one of the configured portfolios.`,
      });
    }
  } else if (p.portfolio) {
    problems.push({
      field: 'portfolio',
      message: 'Only Deputies and Shadow ICs have a portfolio.',
    });
  }
  return problems;
}

/** Case-insensitive lookup that returns the canonical spelling from the list. */
export function canonical(value: string, list: readonly string[]): string {
  return list.find((item) => item.toLowerCase() === value.trim().toLowerCase()) ?? value.trim();
}
