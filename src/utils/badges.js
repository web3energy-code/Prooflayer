/**
 * Badge Engine
 * Defines all badges and the logic to evaluate which badges a user has earned.
 */

const BADGE_DEFINITIONS = [
  // ── Contribution type badges ──────────────────────────────
  {
    id: 'first_thread',
    name: 'Storyteller',
    emoji: '✍️',
    description: 'Submitted your first thread contribution',
    category: 'contribution',
    check: ({ breakdown }) => (breakdown.thread?.count || 0) >= 1,
  },
  {
    id: 'writer',
    name: 'Writer',
    emoji: '📝',
    description: 'Submitted 5+ thread contributions',
    category: 'contribution',
    check: ({ breakdown }) => (breakdown.thread?.count || 0) >= 5,
  },
  {
    id: 'designer',
    name: 'Designer',
    emoji: '🎨',
    description: 'Submitted at least one design contribution',
    category: 'contribution',
    check: ({ breakdown }) => (breakdown.design?.count || 0) >= 1,
  },
  {
    id: 'senior_designer',
    name: 'Senior Designer',
    emoji: '🖌️',
    description: 'Submitted 5+ design contributions',
    category: 'contribution',
    check: ({ breakdown }) => (breakdown.design?.count || 0) >= 5,
  },
  {
    id: 'builder',
    name: 'Builder',
    emoji: '🏗️',
    description: 'Submitted at least one code contribution',
    category: 'contribution',
    check: ({ breakdown }) => (breakdown.code?.count || 0) >= 1,
  },
  {
    id: 'core_dev',
    name: 'Core Dev',
    emoji: '💻',
    description: 'Submitted 5+ code contributions',
    category: 'contribution',
    check: ({ breakdown }) => (breakdown.code?.count || 0) >= 5,
  },
  {
    id: 'dao_contributor',
    name: 'DAO Contributor',
    emoji: '🏛️',
    description: 'Participated in at least one DAO activity',
    category: 'contribution',
    check: ({ breakdown }) => (breakdown.dao?.count || 0) >= 1,
  },
  {
    id: 'dao_star',
    name: 'DAO Star',
    emoji: '⭐',
    description: 'Participated in 5+ DAO activities',
    category: 'contribution',
    check: ({ breakdown }) => (breakdown.dao?.count || 0) >= 5,
  },
  {
    id: 'event_goer',
    name: 'Event Goer',
    emoji: '🎪',
    description: 'Attended at least one event',
    category: 'contribution',
    check: ({ breakdown }) => (breakdown.event?.count || 0) >= 1,
  },

  // ── Milestone badges ──────────────────────────────────────
  {
    id: 'getting_started',
    name: 'Getting Started',
    emoji: '🚀',
    description: 'First contribution submitted',
    category: 'milestone',
    check: ({ totalContributions }) => totalContributions >= 1,
  },
  {
    id: 'consistent_contributor',
    name: 'Consistent',
    emoji: '🔥',
    description: '10+ total contributions',
    category: 'milestone',
    check: ({ totalContributions }) => totalContributions >= 10,
  },
  {
    id: 'power_contributor',
    name: 'Power Contributor',
    emoji: '⚡',
    description: '25+ total contributions',
    category: 'milestone',
    check: ({ totalContributions }) => totalContributions >= 25,
  },
  {
    id: 'legend',
    name: 'Legend',
    emoji: '👑',
    description: '50+ total contributions',
    category: 'milestone',
    check: ({ totalContributions }) => totalContributions >= 50,
  },
  {
    id: 'score_100',
    name: 'Rising Star',
    emoji: '🌟',
    description: 'Reached 100 reputation points',
    category: 'milestone',
    check: ({ totalScore }) => totalScore >= 100,
  },
  {
    id: 'score_500',
    name: 'Top Contributor',
    emoji: '🏆',
    description: 'Reached 500 reputation points',
    category: 'milestone',
    check: ({ totalScore }) => totalScore >= 500,
  },
  {
    id: 'score_1000',
    name: 'Elite Builder',
    emoji: '💎',
    description: 'Reached 1000 reputation points',
    category: 'milestone',
    check: ({ totalScore }) => totalScore >= 1000,
  },

  // ── Special badges ────────────────────────────────────────
  {
    id: 'multi_talent',
    name: 'Multi-Talent',
    emoji: '🎯',
    description: 'Contributed in 3+ different categories',
    category: 'special',
    check: ({ breakdown }) => {
      const active = Object.values(breakdown).filter(v => (v?.count || 0) > 0);
      return active.length >= 3;
    },
  },
  {
    id: 'full_stack',
    name: 'Full Stack',
    emoji: '🌐',
    description: 'Contributed in all 5 categories',
    category: 'special',
    check: ({ breakdown }) => {
      const categories = ['thread', 'design', 'code', 'dao', 'event'];
      return categories.every(c => (breakdown[c]?.count || 0) > 0);
    },
  },
  {
    id: 'early_contributor',
    name: 'Early Contributor',
    emoji: '🐣',
    description: 'One of the first contributors on ProofLayer',
    category: 'special',
    check: ({ userRank }) => userRank !== null && userRank <= 100,
  },
];

/**
 * Evaluate which badges a user should have earned.
 * @param {Object} context - { breakdown, totalScore, totalContributions, userRank }
 * @returns {Array} Array of earned badge definitions
 */
function evaluateBadges(context) {
  return BADGE_DEFINITIONS.filter(badge => {
    try {
      return badge.check(context);
    } catch {
      return false;
    }
  });
}

/**
 * Compute badge delta: which badges to add and which remain.
 * @param {Array} currentBadges - badges already stored on user doc
 * @param {Object} context
 * @returns {{ toAdd: Array, all: Array }}
 */
function computeBadgeDelta(currentBadges, context) {
  const earned = evaluateBadges(context);
  const currentIds = new Set(currentBadges.map(b => b.id));
  const toAdd = earned.filter(b => !currentIds.has(b.id)).map(b => ({
    id: b.id,
    name: b.name,
    emoji: b.emoji,
    description: b.description,
    category: b.category,
    earnedAt: new Date(),
  }));
  return { toAdd, allEarned: earned };
}

module.exports = { BADGE_DEFINITIONS, evaluateBadges, computeBadgeDelta };
