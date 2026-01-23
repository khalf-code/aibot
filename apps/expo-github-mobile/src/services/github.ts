export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
  }
  description: string | null
  private: boolean
  fork: boolean
  language: string | null
  default_branch: string
  updated_at: string
  stargazers_count: number
}

export interface GitHubBranch {
  name: string
  commit: {
    sha: string
  }
  protected: boolean
}

export class GitHubAPI {
  private static readonly BASE_URL = 'https://api.github.com'

  /**
   * Fetch public repositories for a username
   * No authentication required for public repos
   */
  static async getUserRepos(username: string): Promise<GitHubRepo[]> {
    if (!username || username.trim().length === 0) {
      throw new Error('Username is required')
    }

    const response = await fetch(
      `${this.BASE_URL}/users/${encodeURIComponent(username.trim())}/repos?per_page=100&sort=updated&type=all`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Clawdbot-Mobile',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`User "${username}" not found`)
      } else if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please try again later.')
      }
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const repos = await response.json()
    return repos
  }

  /**
   * Fetch branches for a repository
   * No authentication required for public repos
   */
  static async getRepoBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    const response = await fetch(
      `${this.BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Clawdbot-Mobile',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch branches: ${response.status}`)
    }

    return await response.json()
  }

  /**
   * Check if a username exists
   */
  static async checkUsername(username: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/users/${encodeURIComponent(username.trim())}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Clawdbot-Mobile',
          },
        }
      )
      return response.ok
    } catch {
      return false
    }
  }
}
