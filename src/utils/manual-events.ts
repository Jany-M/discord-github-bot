import { getAuthenticatedOctokit } from '../github/oauth';
import { sendToDiscord } from '../discord/bot';
import { getChannelForRepository, loadConfig } from '../config/config';
import {
  formatPushEvent,
  formatPullRequestEvent,
  formatIssueEvent,
} from './formatters';
import {
  GitHubPushEvent,
  GitHubPullRequestEvent,
  GitHubIssueEvent,
} from '../types';
import { logger } from './logger';

/**
 * Manually posts a commit to Discord
 */
export async function postCommit(
  owner: string,
  repo: string,
  commitSha: string
): Promise<void> {
  try {
    const octokit = getAuthenticatedOctokit();
    const repoName = `${owner}/${repo}`;

    logger.info(`Fetching commit ${commitSha} from ${repoName}`);

    // Get commit details
    const { data: commit } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: commitSha,
    });

    // Get repository details
    const { data: repository } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    // Get branch name - only check branches configured in config.json
    let branch = 'main'; // Default fallback
    try {
      // Load config to get the list of branches we should check
      const config = loadConfig();
      const repoConfig = config.repositories.find(r => r.name === `${owner}/${repo}`);
      
      if (!repoConfig || !repoConfig.branches || repoConfig.branches.length === 0) {
        logger.warn(`[Branch Detection] No branches configured for ${owner}/${repo} in config.json`);
        return;
      }
      
      logger.info(`[Branch Detection] Checking configured branches for commit ${commitSha.substring(0, 7)}`);
      logger.info(`[Branch Detection] Configured patterns: ${repoConfig.branches.join(', ')}`);
      
      const { data: allGitHubBranches } = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      });
      
      // Filter branches to only those matching the config patterns
      let branchesToCheck = allGitHubBranches.filter((gitBranch) => {
        return repoConfig!.branches.some((pattern) => {
          // Handle wildcard patterns like "release/*"
          if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return gitBranch.name.startsWith(prefix);
          }
          // Exact match
          return gitBranch.name === pattern;
        });
      });
      
      // Sort by most recently updated (DESC) and take only the 5 most active
      // Get commit dates for sorting
      const branchesWithDates = await Promise.all(
        branchesToCheck.map(async (branch) => {
          try {
            const { data: commit } = await octokit.rest.repos.getCommit({
              owner,
              repo,
              ref: branch.name,
            });
            return {
              branch,
              date: new Date(commit.commit.committer?.date || commit.commit.author?.date || '').getTime(),
            };
          } catch {
            return { branch, date: 0 };
          }
        })
      );
      
      branchesToCheck = branchesWithDates
        .sort((a, b) => b.date - a.date) // DESC - most recent first
        .slice(0, 5) // Only check 5 most active branches
        .map(item => item.branch);
      
      logger.info(`[Branch Detection] Found ${branchesToCheck.length} matching branches (top 5 most active): ${branchesToCheck.map(b => b.name).join(', ')}`);
      
      if (branchesToCheck.length === 0) {
        logger.warn(`[Branch Detection] No GitHub branches match configured patterns`);
        // Fall through to use default
        return;
      }
      
      // Find branches that contain this commit
      const branchCandidates: Array<{ name: string; distance: number; isHead: boolean }> = [];
      
      for (const branchData of branchesToCheck) {
        logger.debug(`[Branch Detection] Checking branch: ${branchData.name}, HEAD: ${branchData.commit.sha.substring(0, 7)}`);
        
        // First check if this commit is the HEAD of the branch (most accurate)
        if (branchData.commit.sha === commitSha) {
          logger.info(`[Branch Detection] ✓ ${branchData.name} has commit as HEAD`);
          branchCandidates.push({
            name: branchData.name,
            distance: 0,
            isHead: true,
          });
          continue;
        }
        
        // Otherwise, check how far from HEAD this commit is on this branch
        try {
          const { data: branchCommits } = await octokit.rest.repos.listCommits({
            owner,
            repo,
            sha: branchData.name,
            per_page: 10, // Check only 10 recent commits
          });
          
          logger.debug(`[Branch Detection] ${branchData.name}: checking recent ${branchCommits.length} commits`);
          
          // Find the index of our commit in this branch's history
          const commitIndex = branchCommits.findIndex(c => c.sha === commitSha);
          
          if (commitIndex !== -1) {
            logger.info(`[Branch Detection] ✓ ${branchData.name} contains commit at position ${commitIndex}`);
            branchCandidates.push({
              name: branchData.name,
              distance: commitIndex,
              isHead: false,
            });
          } else {
            logger.debug(`[Branch Detection] ✗ ${branchData.name} does NOT contain commit in recent 200`);
          }
        } catch (error) {
          logger.warn(`[Branch Detection] Could not check commits on ${branchData.name}:`, error);
        }
      }
      
      logger.info(`[Branch Detection] Found ${branchCandidates.length} candidate branches: ${branchCandidates.map(b => `${b.name}(dist:${b.distance},HEAD:${b.isHead})`).join(', ')}`);
      
      if (branchCandidates.length > 0) {
        // Sort: branches where commit is HEAD first, then by distance (closest to HEAD)
        branchCandidates.sort((a, b) => {
          if (a.isHead && !b.isHead) return -1;
          if (!a.isHead && b.isHead) return 1;
          return a.distance - b.distance;
        });
        
        const selected = branchCandidates[0];
        branch = selected.name;
        logger.info(`[Branch Detection] ✓ Selected: ${branch} (isHead: ${selected.isHead}, distance: ${selected.distance})`);
      } else {
        logger.warn(`[Branch Detection] No configured branches contain commit, using default: ${branch}`);
      }
    } catch (error) {
      logger.warn(`[Branch Detection] Error determining branch for commit ${commitSha.substring(0, 7)}:`, error);
    }
    
    // Get commit statistics (added/removed lines)
    let stats = { additions: 0, deletions: 0, total: 0 };
    try {
      const { data: commitWithStats } = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: commitSha,
      });
      
      if (commitWithStats.stats) {
        stats = {
          additions: commitWithStats.stats.additions || 0,
          deletions: commitWithStats.stats.deletions || 0,
          total: commitWithStats.stats.total || 0,
        };
      }
    } catch (error) {
      logger.warn(`Could not get commit stats for ${commitSha}`);
    }

    // Format as push event with stats
    const pushEvent: GitHubPushEvent = {
      ref: `refs/heads/${branch}`,
      repository: {
        name: repository.name,
        full_name: repository.full_name,
        html_url: repository.html_url,
        owner: {
          login: repository.owner.login,
          avatar_url: repository.owner.avatar_url || '',
        },
      },
      commits: [
        {
          id: commit.sha,
          message: commit.commit.message,
          url: commit.html_url,
          author: {
            name: commit.commit.author?.name || commit.author?.login || 'Unknown',
            email: commit.commit.author?.email || '',
            username: commit.author?.login || 'Unknown',
          },
          stats: stats,
        },
      ],
      head_commit: {
        id: commit.sha,
        message: commit.commit.message,
        url: commit.html_url,
        author: {
          name: commit.commit.author?.name || commit.author?.login || 'Unknown',
          email: commit.commit.author?.email || '',
          username: commit.author?.login || 'Unknown',
        },
        stats: stats,
      },
      pusher: {
        name: commit.author?.login || 'Unknown',
      },
    };

    const channelId = getChannelForRepository(repoName);
    const embed = formatPushEvent(pushEvent);

    await sendToDiscord(channelId, { embeds: [embed] });
    logger.info(`Manually posted commit ${commitSha} to Discord`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to post commit ${commitSha}:`, {
      message: errorMessage,
      error: error,
    });
    throw error;
  }
}

/**
 * Manually posts a pull request to Discord
 */
export async function postPullRequest(
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  try {
    const octokit = getAuthenticatedOctokit();
    const repoName = `${owner}/${repo}`;

    logger.info(`Fetching PR #${prNumber} from ${repoName}`);

    // Get PR details
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get repository details
    const { data: repository } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    // Determine action based on PR state
    const action = pr.state === 'closed' && pr.merged ? 'closed' : pr.state === 'open' ? 'opened' : 'closed';

    // Format as pull request event
    const prEvent: GitHubPullRequestEvent = {
      action: action as 'opened' | 'closed',
      pull_request: {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        html_url: pr.html_url,
        state: pr.state as 'open' | 'closed',
        merged: pr.merged || false,
        merged_at: pr.merged_at,
        user: {
          login: pr.user.login,
          avatar_url: pr.user.avatar_url || '',
        },
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha,
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha,
        },
      },
      repository: {
        name: repository.name,
        full_name: repository.full_name,
        html_url: repository.html_url,
        owner: {
          login: repository.owner.login,
          avatar_url: repository.owner.avatar_url || '',
        },
      },
    };

    const channelId = getChannelForRepository(repoName);
    const embed = formatPullRequestEvent(prEvent);

    await sendToDiscord(channelId, { embeds: [embed] });
    logger.info(`Manually posted PR #${prNumber} to Discord`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to post PR #${prNumber}:`, {
      message: errorMessage,
      error: error,
    });
    throw error;
  }
}

/**
 * Manually posts an issue to Discord
 */
export async function postIssue(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<void> {
  try {
    const octokit = getAuthenticatedOctokit();
    const repoName = `${owner}/${repo}`;

    logger.info(`Fetching issue #${issueNumber} from ${repoName}`);

    // Get issue details
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    // Get repository details
    const { data: repository } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    // Determine action based on issue state
    const action = issue.state === 'open' ? 'opened' : 'closed';

    // Format as issue event
    const issueEvent: GitHubIssueEvent = {
      action: action as 'opened' | 'closed',
      issue: {
        number: issue.number,
        title: issue.title,
        body: issue.body || null,
        html_url: issue.html_url,
        state: issue.state as 'open' | 'closed',
        user: {
          login: issue.user?.login || 'Unknown',
          avatar_url: issue.user?.avatar_url || '',
        },
      },
      repository: {
        name: repository.name,
        full_name: repository.full_name,
        html_url: repository.html_url,
        owner: {
          login: repository.owner.login,
          avatar_url: repository.owner.avatar_url || '',
        },
      },
    };

    const channelId = getChannelForRepository(repoName);
    const embed = formatIssueEvent(issueEvent);

    await sendToDiscord(channelId, { embeds: [embed] });
    logger.info(`Manually posted issue #${issueNumber} to Discord`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to post issue #${issueNumber}:`, {
      message: errorMessage,
      error: error,
    });
    throw error;
  }
}

