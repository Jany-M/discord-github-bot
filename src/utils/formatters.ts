import { EmbedBuilder } from 'discord.js';
import {
  GitHubPushEvent,
  GitHubPullRequestEvent,
  GitHubIssueEvent,
  GitHubReleaseEvent,
} from '../types';

const DISCORD_FIELD_VALUE_MAX = 1024;

function truncateForField(value: string, max = DISCORD_FIELD_VALUE_MAX): string {
  if (value.length <= max) {
    return value;
  }

  // Reserve 3 chars for an ellipsis marker.
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}

function buildCommitListField(commits: GitHubPushEvent['commits']): string {
  const lines = commits.slice(0, 10).map(commit => {
    const firstLine = (commit.message || '').split('\n')[0] || '(no message)';
    const shortSha = commit.id.substring(0, 7);
    // Keep each line bounded so one oversized subject cannot break the whole field.
    return truncateForField(`[\`${shortSha}\`](${commit.url}) ${firstLine}`, 220);
  });

  if (lines.length === 0) {
    return 'No commit details were included in this push payload.';
  }

  return truncateForField(lines.join('\n'));
}

function repoPrivacyIcon(repo: { private: boolean }): string {
  // GitHub webhook payloads always include the 'private' boolean field
  // true = private repository (🔒), false = public repository (🔓)
  return repo.private === true ? '🔒' : '🔓';
}

function getPushStats(commits: GitHubPushEvent['commits'], headCommit: GitHubPushEvent['head_commit']) {
  let additions = 0;
  let deletions = 0;
  let counted = false;

  for (const commit of commits) {
    if (commit.stats) {
      additions += commit.stats.additions || 0;
      deletions += commit.stats.deletions || 0;
      counted = true;
    }
  }

  if (!counted && headCommit?.stats) {
    additions = headCommit.stats.additions || 0;
    deletions = headCommit.stats.deletions || 0;
    counted = true;
  }

  return counted ? { additions, deletions } : null;
}

/**
 * Formats a push event into a Discord embed
 */
export function formatPushEvent(event: GitHubPushEvent): EmbedBuilder {
  const branch = event.ref.replace('refs/heads/', '');
  const latestCommit = event.head_commit || event.commits[event.commits.length - 1];
  const commitCount = event.commits.length;
  const stats = getPushStats(event.commits, latestCommit);
  const thumbnail = event.sender?.avatar_url || event.repository.owner.avatar_url;

  // Build stats fields with color indicators
  const statsFields: Array<{ name: string; value: string; inline: boolean }> = [];
  if (stats) {
    // Always show both columns for consistency, even if zero
    statsFields.push({
      name: '✅ Lines Added',
      value: `\`+${stats.additions}\``,
      inline: true,
    });

    statsFields.push({
      name: '❌ Lines Removed',
      value: `\`-${stats.deletions}\``,
      inline: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ea043) // Green
    .setTitle(`📝 ${commitCount} new commit${commitCount > 1 ? 's' : ''} to ${branch}`)
    .setAuthor({
      name: `${repoPrivacyIcon(event.repository)} ${event.repository.full_name}`,
      url: event.repository.html_url,
      iconURL: event.repository.owner.avatar_url,
    });
    // Removed duplicate commit description - already shown in commit list below
    // .setDescription(`**Latest commit:** [${latestCommit.id.substring(0, 7)}](${latestCommit.url}) ${latestCommit.message.split('\n')[0]}`);

  // Add fields: Row 1 (Author, Branch, Empty), Row 2 (Added, Removed, Total)
  // Discord shows exactly 3 inline fields per row
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  
  // First row: Author, Branch, and an empty placeholder to force wrapping
  fields.push(
    {
      name: '👤 Author',
      value: latestCommit?.author.name || latestCommit?.author.username || event.pusher.name,
      inline: true,
    },
    {
      name: '🌿 Branch',
      value: branch,
      inline: true,
    },
    {
      name: '\u200b', // Empty placeholder to complete row 1 (3 fields per row)
      value: '\u200b',
      inline: true,
    }
  );

  // Second row: Stats fields (optional)
  if (statsFields.length > 0) {
    fields.push(...statsFields);
    // Add empty placeholder to align with row above (3 fields per row)
    fields.push({
      name: '\u200b',
      value: '\u200b',
      inline: true,
    });
  }

  embed.addFields(fields)
    .setURL(`${event.repository.html_url}/commits/${branch}`)
    .setTimestamp(new Date())
    .setThumbnail(thumbnail);

  // Always show commit list (up to 10), even for a single-commit push
  const commitList = buildCommitListField(event.commits);

  embed.addFields({
    name: '📋 Commits',
    value: commitList,
    inline: false,
  });

  return embed;
}

/**
 * Formats a pull request event into a Discord embed
 */
export function formatPullRequestEvent(event: GitHubPullRequestEvent): EmbedBuilder {
  const pr = event.pull_request;
  const action = event.action;
  const isMerged = pr.merged && action === 'closed';
  const additions = pr.additions ?? 0;
  const deletions = pr.deletions ?? 0;

  let color: number;
  let title: string;
  let description: string;

  if (isMerged) {
    color = 0x6f42c1; // Purple
    title = `✅ Pull Request Merged: #${pr.number} ${pr.title}`;
    description = `Merged \`${pr.head.ref}\` into \`${pr.base.ref}\``;
  } else if (action === 'opened') {
    color = 0x28a745; // Green
    title = `🆕 Pull Request Opened: #${pr.number} ${pr.title}`;
    description = pr.body ? pr.body.substring(0, 500) + (pr.body.length > 500 ? '...' : '') : 'No description';
  } else if (action === 'closed') {
    color = 0xd73a49; // Red
    title = `❌ Pull Request Closed: #${pr.number} ${pr.title}`;
    description = `Closed without merging`;
  } else {
    color = 0x0366d6; // Blue
    title = `🔄 Pull Request Updated: #${pr.number} ${pr.title}`;
    description = `New commits added to \`${pr.head.ref}\``;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setAuthor({
      name: `${repoPrivacyIcon(event.repository)} ${event.repository.full_name}`,
      url: event.repository.html_url,
      iconURL: event.repository.owner.avatar_url,
    })
    .setDescription(description)
    .addFields(
      {
        name: '👤 Author',
        value: pr.user.login,
        inline: true,
      },
      {
        name: '🌿 Branch',
        value: `${pr.head.ref} → ${pr.base.ref}`,
        inline: true,
      },
      {
        name: '🔗 Link',
        value: `[View on GitHub](${pr.html_url})`,
        inline: true,
      },
      {
        name: '✅ Lines Added',
        value: `\`+${additions}\``,
        inline: true,
      },
      {
        name: '❌ Lines Removed',
        value: `\`-${deletions}\``,
        inline: true,
      },
      {
        name: '\u200b',
        value: '\u200b',
        inline: true,
      }
    )
    .setURL(pr.html_url)
    .setTimestamp(new Date(pr.merged_at || new Date()));

  if (pr.user.avatar_url) {
    embed.setThumbnail(pr.user.avatar_url);
  }

  return embed;
}

/**
 * Formats an issue event into a Discord embed
 */
export function formatIssueEvent(event: GitHubIssueEvent): EmbedBuilder {
  const issue = event.issue;
  const action = event.action;

  let color: number;
  let title: string;
  let emoji: string;

  if (action === 'opened') {
    color = 0x28a745; // Green
    emoji = '🆕';
  } else if (action === 'closed') {
    color = 0xd73a49; // Red
    emoji = '✅';
  } else {
    color = 0x0366d6; // Blue
    emoji = '🔄';
  }

  title = `${emoji} Issue ${action.charAt(0).toUpperCase() + action.slice(1)}: #${issue.number} ${issue.title}`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setAuthor({
      name: `${repoPrivacyIcon(event.repository)} ${event.repository.full_name}`,
      url: event.repository.html_url,
      iconURL: event.repository.owner.avatar_url,
    })
    .setDescription(issue.body ? issue.body.substring(0, 500) + (issue.body.length > 500 ? '...' : '') : 'No description')
    .addFields(
      {
        name: '👤 Author',
        value: issue.user.login,
        inline: true,
      },
      {
        name: '📊 State',
        value: issue.state,
        inline: true,
      },
      {
        name: '🔗 Link',
        value: `[View on GitHub](${issue.html_url})`,
        inline: true,
      }
    )
    .setURL(issue.html_url)
    .setTimestamp(new Date());

  if (issue.user.avatar_url) {
    embed.setThumbnail(issue.user.avatar_url);
  }

  return embed;
}

/**
 * Formats a release event into a Discord embed
 */
export function formatReleaseEvent(event: GitHubReleaseEvent): EmbedBuilder {
  const release = event.release;
  const action = event.action;

  if (action !== 'published') {
    // Only show published releases
    throw new Error(`Release action "${action}" is not supported for notifications`);
  }

  const embed = new EmbedBuilder()
    .setColor(0xf1e05a) // Yellow/Gold
    .setTitle(`🚀 Release Published: ${release.tag_name}`)
    .setAuthor({
      name: `${repoPrivacyIcon(event.repository)} ${event.repository.full_name}`,
      url: event.repository.html_url,
      iconURL: event.repository.owner.avatar_url,
    })
    .setDescription(release.body ? release.body.substring(0, 1000) + (release.body.length > 1000 ? '...' : '') : 'No release notes')
    .addFields(
      {
        name: '🏷️ Tag',
        value: release.tag_name,
        inline: true,
      },
      {
        name: '👤 Author',
        value: release.author.login,
        inline: true,
      },
      {
        name: '🔗 Link',
        value: `[View on GitHub](${release.html_url})`,
        inline: true,
      }
    )
    .setURL(release.html_url)
    .setTimestamp(new Date(release.published_at));

  if (release.author.avatar_url) {
    embed.setThumbnail(release.author.avatar_url);
  }

  return embed;
}

