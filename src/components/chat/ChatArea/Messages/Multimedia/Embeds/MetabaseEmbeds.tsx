'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { refreshMetabaseEmbedAPI } from '@/api/os'
import { constructEndpointUrl } from '@/lib/constructEndpointUrl'
import { useStore } from '@/store'
import { type MetabaseEmbedData } from '@/types/os'

const REFRESH_SKEW_SECONDS = 30
const REFRESH_POLL_MS = 15_000

const MetabaseEmbedCard = ({ embed }: { embed: MetabaseEmbedData }) => {
  const selectedEndpoint = useStore((state) => state.selectedEndpoint)
  const authToken = useStore((state) => state.authToken)

  const endpointUrl = useMemo(
    () => constructEndpointUrl(selectedEndpoint),
    [selectedEndpoint]
  )

  const [iframeUrl, setIframeUrl] = useState(embed.iframe_url)
  const [expiresAt, setExpiresAt] = useState(embed.expires_at)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isRefreshingRef = useRef(false)

  useEffect(() => {
    setIframeUrl(embed.iframe_url)
    setExpiresAt(embed.expires_at)
    setRefreshError(null)
  }, [embed.expires_at, embed.iframe_url])

  const refreshEmbed = useCallback(async () => {
    if (!endpointUrl || isRefreshingRef.current) return
    isRefreshingRef.current = true
    setIsRefreshing(true)
    try {
      const refreshed = await refreshMetabaseEmbedAPI(
        endpointUrl,
        {
          question_id: embed.question_id,
          title: embed.title
        },
        authToken
      )
      setIframeUrl(refreshed.iframe_url)
      setExpiresAt(refreshed.expires_at)
      setRefreshError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setRefreshError(message)
    } finally {
      isRefreshingRef.current = false
      setIsRefreshing(false)
    }
  }, [authToken, embed.question_id, embed.title, endpointUrl])

  useEffect(() => {
    const maybeRefresh = () => {
      const now = Math.floor(Date.now() / 1000)
      if (now >= expiresAt - REFRESH_SKEW_SECONDS) {
        void refreshEmbed()
      }
    }

    maybeRefresh()
    const timer = window.setInterval(maybeRefresh, REFRESH_POLL_MS)
    return () => window.clearInterval(timer)
  }, [expiresAt, refreshEmbed])

  const title = embed.title?.trim() || `Metabase Question ${embed.question_id}`

  return (
    <div className="flex max-w-5xl flex-col gap-2 rounded-lg border border-border/70 bg-background/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-primary">{title}</p>
        <div className="flex items-center gap-3 text-xs">
          {isRefreshing && <span className="text-muted">Refreshing secure link...</span>}
          <button
            type="button"
            onClick={() => void refreshEmbed()}
            className="underline underline-offset-2"
          >
            Refresh
          </button>
          <a
            href={embed.open_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Open in Metabase
          </a>
        </div>
      </div>

      <iframe
        src={iframeUrl}
        title={title}
        className="w-full rounded-md border border-border/60 bg-secondary/20"
        style={{ aspectRatio: '16 / 9' }}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        allow="fullscreen"
      />

      {refreshError && (
        <p className="text-xs text-destructive">
          Failed to refresh embed link. Try Refresh or open Metabase directly.
        </p>
      )}
      <p className="text-xs text-muted">
        If the chart does not load, connect to your company VPN and retry.
      </p>
    </div>
  )
}

MetabaseEmbedCard.displayName = 'MetabaseEmbedCard'

const MetabaseEmbeds = ({ embeds }: { embeds: MetabaseEmbedData[] }) => (
  <div className="flex flex-col gap-4">
    {embeds.map((embed) => (
      <MetabaseEmbedCard
        key={`${embed.kind}-${embed.question_id}`}
        embed={embed}
      />
    ))}
  </div>
)

export default memo(MetabaseEmbeds)
