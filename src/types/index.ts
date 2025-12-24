export interface Config {
  discord: {
    channels: {
      default: string;
      repositories?: Record<string, string>;
    };
  };
  repositories: RepositoryConfig[];
}

export interface RepositoryConfig {
  name: string;
  events: GitHubEventType[];
  branches: string[]; // Use "*" for all branches
  channel?: string; // Optional override for this repo
}

export type GitHubEventType = 'push' | 'pull_request' | 'issues' | 'release';

export interface GitHubPushEvent {
  ref: string;
  repository: {
    name: string;
    full_name: string;
    html_url: string;
    owner: {
      login: string;
      avatar_url: string;
    };
  };
  commits: Array<{
    id: string;
    message: string;
    url: string;
    author: {
      name: string;
      email: string;
      username: string;
    };
    stats?: {
      additions: number;
      deletions: number;
      total: number;
    };
  }>;
  head_commit: {
    id: string;
    message: string;
    url: string;
    author: {
      name: string;
      email: string;
      username: string;
    };
    stats?: {
      additions: number;
      deletions: number;
      total: number;
    };
  };
  pusher: {
    name: string;
  };
}

export interface GitHubPullRequestEvent {
  action: 'opened' | 'closed' | 'synchronize' | 'reopened';
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: 'open' | 'closed';
    merged: boolean;
    merged_at: string | null;
    user: {
      login: string;
      avatar_url: string;
    };
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
  };
  repository: {
    name: string;
    full_name: string;
    html_url: string;
    owner: {
      login: string;
      avatar_url: string;
    };
  };
}

export interface GitHubIssueEvent {
  action: 'opened' | 'closed' | 'reopened';
  issue: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: 'open' | 'closed';
    user: {
      login: string;
      avatar_url: string;
    };
  };
  repository: {
    name: string;
    full_name: string;
    html_url: string;
    owner: {
      login: string;
      avatar_url: string;
    };
  };
}

export interface GitHubReleaseEvent {
  action: 'published' | 'created' | 'edited' | 'deleted';
  release: {
    tag_name: string;
    name: string;
    body: string | null;
    html_url: string;
    author: {
      login: string;
      avatar_url: string;
    };
    published_at: string;
  };
  repository: {
    name: string;
    full_name: string;
    html_url: string;
    owner: {
      login: string;
      avatar_url: string;
    };
  };
}

