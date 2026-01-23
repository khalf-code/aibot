import { useState, useEffect, useCallback } from 'react'
import { GitHubAPI, type GitHubRepo, type GitHubBranch } from '../services/github'
import { useSettings } from './useSettings'

export const useGitHubRepos = () => {
  const { settings, loading: settingsLoading } = useSettings()
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRepos = useCallback(async () => {
    if (!settings.githubUsername) {
      setRepos([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const fetchedRepos = await GitHubAPI.getUserRepos(settings.githubUsername)
      // Filter out forks optionally, sort by updated
      const sortedRepos = fetchedRepos.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      setRepos(sortedRepos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch repositories')
      setRepos([])
    } finally {
      setLoading(false)
    }
  }, [settings.githubUsername])

  useEffect(() => {
    if (!settingsLoading) {
      fetchRepos()
    }
  }, [settingsLoading, fetchRepos])

  return { repos, loading: loading || settingsLoading, error, refetch: fetchRepos }
}

export const useGitHubBranches = (owner: string, repo: string) => {
  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBranches = useCallback(async () => {
    if (!owner || !repo) {
      setBranches([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const fetchedBranches = await GitHubAPI.getRepoBranches(owner, repo)
      setBranches(fetchedBranches)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch branches')
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [owner, repo])

  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  return { branches, loading, error, refetch: fetchBranches }
}

export { type GitHubRepo, type GitHubBranch }
